"""How the server tells Vectorworks there is work waiting.

Vectorworks can't host a long-running server, so something has to make it run the
"MCP Run Job" menu command. On Windows there is no AppleScript, so the default is to
focus the Vectorworks window and press a keyboard shortcut bound to that command.

Triggers:
  hotkey  - focus Vectorworks, send VWMCP_HOTKEY (needs `pip install "vwmcp[windows]"`)
  session - do nothing; the user started "MCP Session" in Vectorworks, which polls the queue
  none    - do nothing; used by the fake Vectorworks in tests

The hotkey trigger is polite: if you're working in Vectorworks it waits until your mouse
buttons are up and you've paused for VWMCP_IDLE_MS, so it never lands mid-drag or mid-type.
If you're in another app (a browser, Claude) it fires straight away and hands focus back.
"""

from __future__ import annotations

import re
import sys
import threading
import time

from .config import Settings


# Vectorworks' program on Windows ("Vectorworks2026.exe" and the like). Not a browser, not Explorer.
DEFAULT_PROCESS_RE = r"(?i)^vectorworks[^\\/]*\.exe$"


class TriggerError(RuntimeError):
    pass


class Trigger:
    def fire(self, job_created: float | None = None) -> None:  # pragma: no cover - interface
        """Make Vectorworks run the queue. job_created: wall-clock time the job was written."""
        raise NotImplementedError


class NoopTrigger(Trigger):
    def fire(self, job_created: float | None = None) -> None:
        return None


# ---- Windows plumbing, kept apart so the logic below is testable on any OS ---------------


class _Win32:
    """Thin ctypes/pywinauto wrapper. Every method is something the tests can fake."""

    VK_LBUTTON, VK_RBUTTON, VK_MBUTTON = 0x01, 0x02, 0x04
    VK_SHIFT, VK_CONTROL, VK_MENU = 0x10, 0x11, 0x12

    def __init__(self) -> None:
        if sys.platform != "win32":
            raise TriggerError("The hotkey trigger only works on Windows. Set VWMCP_TRIGGER=session or none.")
        import ctypes
        from ctypes import wintypes

        try:
            from pywinauto import Desktop, keyboard
            from pywinauto.controls.hwndwrapper import HwndWrapper
        except ImportError as e:
            raise TriggerError('pywinauto is not installed. Run: pip install "vwmcp[windows]"') from e

        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]

        self._ctypes = ctypes
        self._user32 = ctypes.windll.user32
        self._kernel32 = ctypes.windll.kernel32
        self._LASTINPUTINFO = LASTINPUTINFO
        self._Desktop = Desktop
        self._keyboard = keyboard
        self._HwndWrapper = HwndWrapper

    def idle_ms(self) -> int:
        info = self._LASTINPUTINFO()
        info.cbSize = self._ctypes.sizeof(info)
        self._user32.GetLastInputInfo(self._ctypes.byref(info))
        return int(self._kernel32.GetTickCount() - info.dwTime)

    def input_held(self) -> bool:
        keys = (self.VK_LBUTTON, self.VK_RBUTTON, self.VK_MBUTTON, self.VK_SHIFT, self.VK_CONTROL, self.VK_MENU)
        return any(self._user32.GetAsyncKeyState(k) & 0x8000 for k in keys)

    def foreground(self) -> int:
        return int(self._user32.GetForegroundWindow() or 0)

    def windows(self, title_re: str) -> list:
        """Visible top-level windows whose title matches, front to back. Any program's."""
        return [
            w
            for w in self._Desktop(backend="win32").windows(title_re=title_re, visible_only=True)
            if w.class_name() != "ConsoleWindowClass"
        ]

    def exe_name(self, window) -> str | None:
        """The file name of the program that owns the window ("Vectorworks2026.exe"), or None."""
        from ctypes import wintypes

        k = self._kernel32
        handle = k.OpenProcess(0x1000, False, window.process_id())  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return None
        try:
            size = wintypes.DWORD(1024)
            buf = self._ctypes.create_unicode_buffer(size.value)
            if not k.QueryFullProcessImageNameW(handle, 0, buf, self._ctypes.byref(size)):
                return None
            return buf.value.replace("/", "\\").rsplit("\\", 1)[-1] or None
        finally:
            k.CloseHandle(handle)

    def focus(self, window) -> None:
        if window.is_minimized():
            window.restore()
        window.set_focus()

    def focus_hwnd(self, hwnd: int) -> None:
        self._HwndWrapper(hwnd).set_focus()

    def send_keys(self, keys: str) -> None:
        self._keyboard.send_keys(keys)

    def enabled(self, window) -> bool:
        # A modal dialog disables its owner window; a keystroke then goes to the dialog instead.
        return bool(self._user32.IsWindowEnabled(window.handle))

    def process_age_s(self, window) -> float:
        """Seconds since the window's process started (GetProcessTimes)."""
        from ctypes import wintypes

        k = self._kernel32
        pid = window.process_id()
        handle = k.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return 1e9  # can't tell: don't block on it
        try:
            created, exited, kern, user = (wintypes.FILETIME() for _ in range(4))
            if not k.GetProcessTimes(handle, *(self._ctypes.byref(t) for t in (created, exited, kern, user))):
                return 1e9
            now = wintypes.FILETIME()
            k.GetSystemTimeAsFileTime(self._ctypes.byref(now))
            ticks = lambda ft: (ft.dwHighDateTime << 32) | ft.dwLowDateTime  # noqa: E731
            return (ticks(now) - ticks(created)) / 1e7
        finally:
            k.CloseHandle(handle)

    def capture_png(self, window) -> bytes:
        import io

        try:
            img = window.capture_as_image()  # needs Pillow
        except ImportError as e:
            raise TriggerError('Screenshots need Pillow: pip install "vwmcp[windows]"') from e
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


class HotkeyTrigger(Trigger):
    _lock = threading.Lock()  # one focus dance at a time, across every request

    def __init__(
        self,
        hotkey: str,
        title_re: str,
        restore_focus: bool = True,
        process_re: str = DEFAULT_PROCESS_RE,
        idle_ms: int = 600,
        idle_max_s: float = 20.0,
        win=None,
        sleep=time.sleep,
        clock=time.monotonic,
        wall=time.time,
    ):
        self.hotkey = hotkey
        self.title_re = title_re
        self.process_re = re.compile(process_re)
        self.restore_focus = restore_focus
        self.idle_ms = idle_ms
        self.idle_max_s = idle_max_s
        self._win = win
        self._sleep = sleep
        self._clock = clock
        self._wall = wall
        self._last_press_wall = -1e18

    @property
    def win(self):
        if self._win is None:
            self._win = _Win32()
        return self._win

    STARTUP_GRACE_S = 30.0  # scripting Vectorworks this soon after launch can crash it

    def find_window(self):
        """The front-most Vectorworks window, or None.

        The title alone isn't enough: a browser tab on the panel page is titled "Vectorworks -
        Cyber Wolf", and pressing the shortcut there would do nothing (or something else). So a
        window counts only if its program's file name matches VWMCP_PROCESS_RE. A program we
        can't read the name of doesn't count either: better "not found" than keys sent to the
        wrong app.
        """
        self._skipped = []
        for w in self.win.windows(self.title_re):
            exe = self.win.exe_name(w)
            if exe and self.process_re.search(exe):
                return w
            self._skipped.append(exe or "a program whose name couldn't be read")
        return None

    def _not_found(self, doing: str) -> TriggerError:
        msg = f"No Vectorworks window found{doing}. Is Vectorworks open with a drawing?"
        if self._skipped:
            seen = ", ".join(sorted(set(self._skipped)))
            msg += (
                f" (Windows with 'Vectorworks' in the title belong to: {seen}. If one of those is"
                " Vectorworks itself, set VWMCP_PROCESS_RE to match its program name.)"
            )
        return TriggerError(msg)

    def _target(self):
        target = self.find_window()
        if target is None:
            raise self._not_found("")
        if self.win.process_age_s(target) < self.STARTUP_GRACE_S:
            raise TriggerError("Vectorworks only just started. Give it 30 seconds to settle, then try again.")
        if not self.win.enabled(target):
            raise TriggerError("Vectorworks has a dialog open. Close it, then try again.")
        return target

    def capture_png(self) -> bytes:
        target = self.find_window()
        if target is None:
            raise self._not_found(" to capture")
        with self._lock:
            self.win.focus(target)  # capture what's on screen, not what's behind another window
            self._sleep(0.3)
            return self.win.capture_png(target)

    def _wait_until_user_pauses(self, vw_handle: int) -> None:
        """Only matters when the person is working IN Vectorworks right now."""
        deadline = self._clock() + self.idle_max_s
        while self._clock() < deadline:
            if self.win.foreground() != vw_handle:
                return  # they're elsewhere: nothing of theirs to collide with
            if not self.win.input_held() and self.win.idle_ms() >= self.idle_ms:
                return
            self._sleep(0.1)
        # They've been busy the whole time; fire anyway rather than stall Claude forever.

    def fire(self, job_created: float | None = None) -> None:
        with self._lock:
            # The run started by the last press scans the queue after that press, so a job
            # written before it gets picked up without pressing again. (A lost press is
            # recovered by the queue, which presses again if the job sits unclaimed.)
            if job_created is not None and job_created <= self._last_press_wall:
                return
            target = self._target()

            self._wait_until_user_pauses(target.handle)
            previous = self.win.foreground()
            self.win.focus(target)
            self._sleep(0.15)  # let focus settle before the keystroke
            self._last_press_wall = self._wall()
            self.win.send_keys(self.hotkey)

            if self.restore_focus and previous and previous != target.handle:
                self._sleep(0.4)  # give Vectorworks time to start the menu command
                try:
                    self.win.focus_hwnd(previous)
                except Exception:
                    pass  # focus restore is a nicety, never fail the job over it


def make_trigger(settings: Settings) -> Trigger:
    if settings.trigger == "hotkey":
        return HotkeyTrigger(
            settings.hotkey,
            settings.window_title_re,
            settings.restore_focus,
            process_re=settings.process_re,
            idle_ms=settings.idle_ms,
        )
    if settings.trigger in {"session", "none"}:
        return NoopTrigger()
    raise ValueError(f"Unknown VWMCP_TRIGGER: {settings.trigger!r} (use hotkey, session or none)")
