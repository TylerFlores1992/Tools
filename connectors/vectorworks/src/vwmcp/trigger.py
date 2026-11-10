"""How the server tells Vectorworks there is work waiting.

Vectorworks can't host a long-running server, so something has to make it run the
"MCP Run Job" menu command. On Windows there is no AppleScript, so the default is to
focus the Vectorworks window and press a keyboard shortcut bound to that command.

Triggers:
  menu    - (default) press Tools > MCP Run Job through Windows' accessibility interface (UI
            Automation): no keystrokes and no focus change, so it works while Windows is locked.
            Falls back to the hotkey when the PC is unlocked and the menu can't be reached.
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
from typing import NamedTuple

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


class Prompt(NamedTuple):
    phrase: str  # words in the dialog, lower case
    buttons: tuple[str, ...]  # the button to press (first one found)
    tick: str = ""  # a checkbox to tick first, by its words


# Prompts Vectorworks shows that are safe to answer for the user, measured on Vectorworks 2026.
PROMPTS = (
    # Opening an older file converts it into a renamed copy; the original file is never changed.
    Prompt("created with an older version of vectorworks", ("OK",)),
    # A converted copy has no name, so 30 minutes later autosave asks to name and save it. No
    # (and stop asking): the copy is only read, and saving it would put files in the user's folders.
    Prompt(
        "a backup copy cannot be created until this document has been named",
        ("No",),
        tick="don't back up this document",
    ),
)
DISCARD_BUTTONS = ("No", "Don't Save", "Do not save")


def pick_prompt(words: str) -> Prompt | None:
    words = _plain(words)
    return next((p for p in PROMPTS if _plain(p.phrase) in words), None)


def is_save_prompt_for(words: str, name: str) -> bool:
    """A "save changes to <name>?" dialog for exactly this document. Matching the name is what keeps
    the user's own drawings safe: only the copy the connector opened is ever discarded."""
    words = _plain(words)
    stem = _plain(re.sub(r"\.vwx$", "", name, flags=re.I).strip())
    return bool(stem) and "save" in words and stem in words


def _plain(s: str) -> str:
    return (s or "").lower().replace("\u2019", "'").replace("\u2018", "'")


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

    def locked(self) -> bool:
        """Is Windows on the lock screen? LogonUI.exe runs exactly while it shows. (Measured on the
        owner's PC: the input-desktop and WTS session-flag tests both read wrong there.)"""
        import subprocess

        out = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq LogonUI.exe", "/NH"],
            capture_output=True, text=True, creationflags=0x08000000,  # CREATE_NO_WINDOW
        ).stdout
        return "logonui.exe" in out.lower()

    def accept_prompts(self, window) -> list[str]:
        """Answer a known Vectorworks prompt (UI Automation, no keys: works locked). Returns what it
        answered. Unknown dialogs are left alone."""
        pressed = []
        for w in self._dialogs(window):
            hit = pick_prompt(self._words(w))
            if hit is None:
                continue
            if hit.tick:
                self._tick(w, hit.tick)
            if self._press(w, hit.buttons):
                pressed.append(hit.phrase)
        return pressed

    def discard_copy(self, window, name: str, wait: float = 10.0) -> bool:
        """After File > Close: say No to "save changes?" for this one document (by name), so a
        converted copy is thrown away. Any other dialog is left alone. True when it answered."""
        import time as _t

        deadline = _t.monotonic() + wait
        while _t.monotonic() < deadline:
            for w in self._dialogs(window):
                if is_save_prompt_for(self._words(w), name) and self._press(w, DISCARD_BUTTONS):
                    return True
            _t.sleep(0.3)
        return False

    # -- UI Automation plumbing for the two above --
    def _dialogs(self, window) -> list:
        from pywinauto import Desktop

        try:
            found = list(Desktop(backend="uia").windows(process=window.process_id()))
            found += Desktop(backend="uia").window(handle=window.handle).descendants(control_type="Window")
        except Exception:
            return []
        return found

    @staticmethod
    def _words(w) -> str:
        try:
            return " ".join(t.window_text() for t in w.descendants(control_type="Text")).lower()
        except Exception:
            return ""

    @staticmethod
    def _press(w, names) -> bool:
        want = [n.lower() for n in names]
        try:
            buttons = w.descendants(control_type="Button")
        except Exception:
            return False
        for name in want:
            for b in buttons:
                if b.window_text().replace("&", "").strip().lower() == name:
                    b.invoke()
                    return True
        return False

    @staticmethod
    def _tick(w, words: str) -> None:
        try:
            for c in w.descendants(control_type="CheckBox"):
                if words in c.window_text().replace("&", "").lower():
                    if c.get_toggle_state() == 0:
                        c.toggle()
                    return
        except Exception:
            pass  # the tick is a nicety; the button press is what matters

    def press_menu(self, window, menu: str, item: str, open_wait: float = 4.0) -> None:
        """Press `menu > item` in Vectorworks through UI Automation (no keys, no focus change).

        What Vectorworks 2026 shows to UI Automation, measured: its menu bar items answer Invoke
        (not Expand); an open menu's items appear inside the main window; and after a command runs,
        that menu's items STAY listed while the menu bar drops out, so the next press goes straight
        to the item. Raises TriggerError when it can't."""
        import time as _t

        from pywinauto import Desktop

        vw = Desktop(backend="uia").window(handle=window.handle)
        want = item.strip().lower()

        def listed():
            for m in vw.descendants(control_type="MenuItem"):
                if m.window_text().split("\t")[0].strip().lower() == want:
                    return m
            return None

        hit = listed()
        if hit is None:
            top = None
            for bar in vw.descendants(control_type="MenuBar"):
                top = next((m for m in bar.children() if m.window_text() == menu), None) or top
            if top is None:
                top = next((m for m in vw.descendants(control_type="MenuItem") if m.window_text() == menu), None)
            if top is None:
                raise TriggerError(f"Vectorworks' {menu} menu isn't visible to Windows' accessibility interface.")
            top.invoke()
            deadline = _t.monotonic() + open_wait
            while hit is None and _t.monotonic() < deadline:
                _t.sleep(0.1)
                hit = listed()
            if hit is None:
                try:
                    top.invoke()  # close it again
                except Exception:
                    pass
                raise TriggerError(f"'{item}' isn't in Vectorworks' {menu} menu. Set VWMCP_MENU to the menu you put it in.")
        try:
            hit.invoke()
        except Exception:
            # Invoke waits for the command, and a long one (a read-out with 3D faces keeps Vectorworks
            # busy 20 s and more) makes it give up with an error although the press went through.
            # Measured 2026-11-10: treating that as a failed press sent the connector to the keyboard
            # fallback, which found no window in the busy Vectorworks, so every big read-out "failed"
            # while Vectorworks finished it. The queue presses again only if the job sits unclaimed.
            pass

    def cancel_menus(self, window) -> None:
        """Close a menu left open (Vectorworks keeps Tools open after the job's menu press) with
        WM_CANCELMODE: a window message, not a key, so it works on the lock screen too."""
        import ctypes

        ctypes.windll.user32.SendMessageW(window.handle, 0x001F, 0, 0)  # type: ignore[attr-defined]

    def title(self, window) -> str:
        return window.window_text() or ""

    def open_file(self, path) -> None:
        import os

        os.startfile(str(path))  # type: ignore[attr-defined]  # Windows: opens it in Vectorworks

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
        blank=None,
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
        self.blank = blank
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

    LOCKED = (
        "Your PC is on the lock screen, where Windows lets no keystroke through, so Vectorworks can't be"
        " told to run the job. Sign in on the PC once, or stop Windows asking after sleep: Settings >"
        " Accounts > Sign-in options > 'If you've been away, when should Windows require you to sign in"
        " again?' > Never."
    )
    BLANK_WAIT_S = 60.0

    @staticmethod
    def has_drawing(title: str) -> bool:
        """Vectorworks names the open drawing in its title ("Vectorworks Design Suite 2026 - [x.vwx]").
        A bare product name means no drawing. Anything unexpected counts as a drawing: opening the
        blank on top of someone's real drawing would send the next job to the wrong file."""
        bare = re.fullmatch(r"\s*Vectorworks[\w .]*\s*", title or "")
        return not bare

    def _ensure_drawing(self, target):
        """Vectorworks with no drawing has its menu commands off; open the blank drawing so the
        shortcut works. Returns the window to press the shortcut in."""
        title = getattr(self.win, "title", lambda w: "Vectorworks - [drawing]")(target)
        if self.has_drawing(title):
            return target
        if not self.blank or not self.blank.exists():
            raise TriggerError(
                "Vectorworks is open but no drawing is, and its menu commands only work with one open."
                f" Open any drawing, or save a blank one as {self.blank} (the connector then opens it by itself)."
            )
        self.win.open_file(self.blank)
        deadline = self._clock() + self.BLANK_WAIT_S
        while self._clock() < deadline:
            self._sleep(1.0)
            w = self.find_window()
            if w is not None and self.has_drawing(self.win.title(w)):
                self._sleep(2.0)  # let it finish opening before the keystroke
                return w
        raise TriggerError(f"Opened {self.blank.name} but Vectorworks didn't show it within a minute.")

    def _target(self):
        if getattr(self.win, "locked", lambda: False)():
            raise TriggerError(self.LOCKED)
        target = self.find_window()
        if target is None:
            raise self._not_found("")
        if self.win.process_age_s(target) < self.STARTUP_GRACE_S:
            raise TriggerError("Vectorworks only just started. Give it 30 seconds to settle, then try again.")
        if not self.win.enabled(target):
            raise TriggerError("Vectorworks has a dialog open. Close it, then try again.")
        return self._ensure_drawing(target)

    def close_copy(self, name: str) -> bool:
        """Close the converted copy of a drawing the connector opened for a read-out, without saving
        (File > Close, then No to "save changes?" for that name only). Only when Vectorworks' title
        shows that copy in front, so the user's own drawing is never the one closed. Works locked."""
        with self._lock:
            target = self.find_window()
            if target is None:
                return False
            stem = re.sub(r"\.vwx$", "", name, flags=re.I).strip().lower()
            title = getattr(self.win, "title", lambda w: "")(target).lower()
            if not stem or stem not in title:
                return False
            self.win.accept_prompts(target)  # the 30-minute backup box would block the menu
            getattr(self.win, "cancel_menus", lambda w: None)(target)  # the job's Tools menu stays open
            self._sleep(0.5)
            self.win.press_menu(target, "File", "Close")
            self.win.discard_copy(target, name)
            self._sleep(1.0)
            after = self.find_window()
            return after is None or stem not in getattr(self.win, "title", lambda w: "")(after).lower()

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


class MenuTrigger(HotkeyTrigger):
    """Presses Tools > MCP Run Job without the keyboard, so it works on a locked PC. If that fails
    and the PC is unlocked, it presses the shortcut instead (the old way)."""

    def __init__(self, hotkey: str, title_re: str, menu: str = "Tools", item: str = "MCP Run Job", **kw):
        super().__init__(hotkey, title_re, **kw)
        self.menu, self.item = menu, item

    def _menu_target(self):
        target = self.find_window()
        if target is None:
            raise self._not_found("")
        if self.win.process_age_s(target) < self.STARTUP_GRACE_S:
            raise TriggerError("Vectorworks only just started. Give it 30 seconds to settle, then try again.")
        if getattr(self.win, "accept_prompts", lambda w: [])(target):
            self._sleep(3.0)  # let it carry on opening the file
            target = self.find_window() or target
        if not self.win.enabled(target):
            raise TriggerError("Vectorworks has a dialog open. Close it, then try again.")
        return self._ensure_drawing(target)

    def fire(self, job_created: float | None = None) -> None:
        with self._lock:
            if job_created is not None and job_created <= self._last_press_wall:
                return
            target = self._menu_target()
            if self.win.foreground() == target.handle:
                self._wait_until_user_pauses(target.handle)  # never pop a menu mid-drag
            try:
                self.win.press_menu(target, self.menu, self.item)
                self._last_press_wall = self._wall()
                return
            except Exception as e:
                menu_error = e
            if self.win.locked():
                raise TriggerError(f"Couldn't press {self.menu} > {self.item} on the locked PC: {menu_error}")
        super().fire(job_created)  # unlocked: the shortcut still works


def make_trigger(settings: Settings) -> Trigger:
    if settings.trigger == "menu":
        return MenuTrigger(
            settings.hotkey,
            settings.window_title_re,
            menu=settings.menu,
            item=settings.menu_item,
            restore_focus=settings.restore_focus,
            process_re=settings.process_re,
            idle_ms=settings.idle_ms,
            blank=settings.blank,
        )
    if settings.trigger == "hotkey":
        return HotkeyTrigger(
            settings.hotkey,
            settings.window_title_re,
            settings.restore_focus,
            process_re=settings.process_re,
            idle_ms=settings.idle_ms,
            blank=settings.blank,
        )
    if settings.trigger in {"session", "none"}:
        return NoopTrigger()
    raise ValueError(f"Unknown VWMCP_TRIGGER: {settings.trigger!r} (use menu, hotkey, session or none)")
