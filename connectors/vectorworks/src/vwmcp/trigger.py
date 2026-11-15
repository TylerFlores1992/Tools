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

import contextlib
import json
import re
import sys
import threading
import time
from pathlib import Path
from typing import NamedTuple

from .config import Settings


def _menu_log(what: str, state: dict | None = None) -> None:
    """One line in ~/.vwmcp/menu.log: what a menu press saw (kept short; it's for diagnosis)."""
    try:
        log = Path.home() / ".vwmcp" / "menu.log"
        if log.exists() and log.stat().st_size > 200_000:
            log.write_text("", encoding="utf-8")
        with log.open("a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + what + ("  " + json.dumps(state, default=str) if state else "") + "\n")
    except Exception:
        pass


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
    # A drawing that uses fonts this PC doesn't have asks which to show instead (measured
    # 2026-11-11 on the Bili Bili rigging file: "Font Mapping", Bank Gothic -> Arial). OK keeps
    # Vectorworks' suggestion; it only changes how text looks here, and the copy is never saved.
    Prompt("font mapping", ("OK",)),
    # A converted copy has no name, so 30 minutes later autosave asks to name and save it. No
    # (and stop asking): the copy is only read, and saving it would put files in the user's folders.
    Prompt(
        "a backup copy cannot be created until this document has been named",
        ("No",),
        tick="don't back up this document",
    ),
)
# Common prompts when opening someone else's drawing, from Vectorworks' help and how its alerts are
# worded; each answer is the one that changes and saves nothing. Not all measured yet: a wording that
# differs simply isn't matched, and the box is passed to the designer instead (pending_prompt).
PROMPTS += (
    # A referenced file (a design layer viewport's source) isn't on this PC: don't go looking.
    Prompt("would you like to locate", ("No", "Skip", "Cancel")),
    # Plug-in objects this Vectorworks doesn't have: they show as boxes; carry on.
    Prompt("plug-in objects could not be found", ("OK", "Continue")),
    Prompt("missing plug-in", ("OK", "Continue")),
    # Textures or images missing: carry on without them.
    Prompt("textures could not be found", ("OK", "Continue", "Ignore")),
    # Someone else has it open: read it, don't take it over.
    Prompt("open it read-only", ("Open Read-Only", "Read-Only", "Read Only")),
    Prompt("is in use by", ("Open Read-Only", "Read-Only", "Read Only")),
)
DISCARD_BUTTONS = ("No", "Don't Save", "Do not save")

# Answers the designer chose for boxes the connector didn't know ("Remember this answer").
LEARNED_FILE = Path.home() / ".vwmcp" / "prompts.json"


def learned_prompts() -> list[Prompt]:
    try:
        rows = json.loads(LEARNED_FILE.read_text(encoding="utf-8"))
        return [
            Prompt(str(r["phrase"]), tuple(str(b) for b in r["buttons"]))
            for r in rows
            if r.get("phrase") and r.get("buttons") and not any(w in str(r["phrase"]) for w in NEVER_LEARN)
        ]
    except (OSError, ValueError, TypeError, KeyError):
        return []


# Error boxes are never learned: answering them by themselves would hide the error that made them.
NEVER_LEARN = ("improper argument", "error", "exception", "failed", "could not be completed")


def remember_prompt(phrase: str, button: str) -> None:
    """Keep the designer's answer, so the same box is answered by itself next time."""
    phrase = _plain(phrase)
    if len(phrase) < 8:
        return  # too short to tell boxes apart: better asked again than answered wrong
    if any(w in phrase for w in NEVER_LEARN):
        return
    rows = [r for r in (json.loads(LEARNED_FILE.read_text(encoding="utf-8")) if LEARNED_FILE.exists() else []) if r.get("phrase") != phrase]
    rows.append({"phrase": phrase, "buttons": [button]})
    LEARNED_FILE.parent.mkdir(parents=True, exist_ok=True)
    LEARNED_FILE.write_text(json.dumps(rows, indent=1), encoding="utf-8")


def _clean(text: str) -> str:
    """A box's words without what changes from file to file: quoted names, paths, file names, numbers."""
    body = re.sub(r"[\"'\u201c\u201d\u2018\u2019][^\"'\u201c\u201d\u2018\u2019]*[\"'\u201c\u201d\u2018\u2019]", " ", text or "")
    body = re.sub(r"\S*[\\/]\S*|\S+\.\w{2,4}\b|\d+", " ", body)
    return " ".join(_plain(body).split())


def prompt_phrase(title: str, text: str) -> str:
    """Words that pick out a box next time: its message without file names, paths and numbers, or
    its title when the message is too short."""
    phrase = " ".join(_clean(text).split()[:10])
    return phrase if len(phrase) >= 15 else _plain(title)


def pick_prompt(words: str) -> Prompt | None:
    plain, clean = _plain(words), _clean(words)
    known = next((p for p in PROMPTS if _plain(p.phrase) in plain), None)
    # Remembered answers are kept without names and numbers, so they're matched the same way.
    return known or next((p for p in learned_prompts() if p.phrase in clean or p.phrase in plain), None)


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
        path = self.exe_path(window)
        return path.replace("/", "\\").rsplit("\\", 1)[-1] or None if path else None

    def exe_path(self, window) -> str | None:
        """The full path of the program that owns the window, or None."""
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
            return buf.value or None
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

    def pending_prompts(self, window) -> list[dict]:
        """Boxes Vectorworks is waiting on that the connector doesn't know how to answer: their
        title, message and buttons. Only while a box holds Vectorworks (its main window is
        disabled), so floating palettes never count."""
        if self.enabled(window):
            return []
        out = []
        for w in self._dialogs(window):
            try:
                if w.handle == window.handle or pick_prompt(self._words(w)):
                    continue
                buttons = [b.window_text().replace("&", "").strip() for b in w.descendants(control_type="Button")]
            except Exception:
                continue
            buttons = [b for b in buttons if b and b not in ("?", "×", "Close", "Help")]
            if not buttons:
                continue
            out.append({"title": (w.window_text() or "").strip(), "text": self._body(w), "buttons": buttons[:8]})
        return out

    def answer_prompt(self, window, button: str) -> dict | None:
        """Press `button` in the box Vectorworks is waiting on. Returns what the box said."""
        for p in self.pending_prompts(window):
            if button.lower() in (b.lower() for b in p["buttons"]):
                for w in self._dialogs(window):
                    if w.handle != window.handle and (w.window_text() or "").strip() == p["title"] and self._body(w) == p["text"]:
                        if self._press(w, (button,)):
                            return p
        return None

    def fill_export_dialogs(self, window, path: str) -> list[str]:
        """While Vectorworks exports a PDF: press through its PDF settings box, type `path` into the
        save box and save, and say Yes to replacing a file of that name. Nothing else is touched.
        Returns what it did."""
        done = []
        for w in self._dialogs(window):
            try:
                if w.handle == window.handle:
                    continue
                words = self._words(w)
                name_box = None
                for e in w.descendants(control_type="Edit"):
                    if "file name" in (e.element_info.name or "").lower():
                        name_box = e
                        break
            except Exception:
                continue
            if "already exists" in words and ("replace" in words or "overwrite" in words):
                # Before the file name: Windows' "Confirm Save As" box shows up to UI Automation
                # inside the save box, so the save box's words carry its question (measured
                # 2026-11-15: answering the save box first pressed Save again and again).
                if self._press(w, ("Yes",)):
                    done.append("replaced the old file")
            elif name_box is not None:
                if not self._set_text(name_box, path):
                    _menu_log(f"save box: couldn't put the path in File name (it says {self._text_of(name_box)!r})")
                    continue
                if self._press(w, ("Save", "Export", "OK")):
                    done.append("saved as " + path)
            elif "pdf" in words:
                # Vectorworks' Export PDF box: don't open the PDF in a viewer (it would hold the file
                # open), then Export. Measured on VW 2026: title "Export PDF", buttons Export/Cancel.
                self._untick(w, "open pdf in the default viewer")
                if self._press(w, ("Export", "OK")):
                    done.append("PDF settings")
        return done

    @staticmethod
    def _text_of(e) -> str:
        import ctypes

        try:
            h = e.handle
            if h:
                buf = ctypes.create_unicode_buffer(2048)
                ctypes.windll.user32.SendMessageW(h, 0x000D, 2048, buf)  # type: ignore[attr-defined]  # WM_GETTEXT
                return buf.value
        except Exception:
            pass
        try:
            return e.get_value() or ""
        except Exception:
            return ""

    def _set_text(self, e, text: str) -> bool:
        """Put `text` in an edit box as typing, and check it's there. Measured 2026-11-15 on VW
        2026's save box ("Export as PDF Document", Windows' own file box): both UI Automation's
        set-value and WM_SETTEXT showed the path in File name, but Save used the box's default name:
        neither tells the box the text changed. Characters sent as WM_CHAR do, like typing (window
        messages: the lock screen doesn't stop them)."""
        import ctypes

        u = ctypes.windll.user32  # type: ignore[attr-defined]
        h = getattr(e, "handle", None)
        if h:
            u.SendMessageW(h, 0x00B1, 0, -1)  # EM_SETSEL: all of it, so the typing replaces it
            u.SendMessageW(h, 0x0102, 0x08, 0)  # WM_CHAR backspace: clear it
            for ch in text:
                u.SendMessageW(h, 0x0102, ord(ch), 0)  # WM_CHAR
        else:
            with contextlib.suppress(Exception):
                e.set_edit_text(text)
        return self._text_of(e).strip().lower() == text.strip().lower()

    @staticmethod
    def _body(w) -> str:
        try:
            return " ".join(t.window_text().strip() for t in w.descendants(control_type="Text") if t.window_text().strip())
        except Exception:
            return ""

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
            # The title too: "Font Mapping" says what it is only there (its list headers aren't text).
            return " ".join([w.window_text()] + [t.window_text() for t in w.descendants(control_type="Text")]).lower()
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
    def _untick(w, words: str) -> None:
        try:
            for c in w.descendants(control_type="CheckBox"):
                if words in c.window_text().replace("&", "").lower():
                    if c.get_toggle_state() == 1:
                        c.toggle()
                    return
        except Exception:
            pass

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

    def press_menu_path(self, window, path: list, open_wait: float = 4.0) -> None:
        """Press a command several menus down, e.g. ["File", "Export", "Export PDF..."], through UI
        Automation: each level is opened (Expand, else Invoke) and the last one invoked. The last
        Invoke can wait for the command to finish (a modal box stays up until answered), so call
        this off the thread that answers those boxes."""
        import time as _t

        from pywinauto import Desktop

        vw = Desktop(backend="uia").window(handle=window.handle)

        def find(name: str, top: bool):
            want = name.strip().lower()
            if top:
                # the menu bar's items (cancel_menus made sure no menu is open: then they're listed
                # as top-level MenuItems; UI Automation doesn't show Vectorworks' bar as a MenuBar)
                for bar in vw.descendants(control_type="MenuBar"):
                    for m in bar.children():
                        if m.window_text().strip().lower() == want:
                            return m
            pools = [vw]
            try:
                pools += list(Desktop(backend="uia").windows(process=window.process_id()))
            except Exception:
                pass
            for pool in pools:
                try:
                    for m in pool.descendants(control_type="MenuItem"):
                        if m.window_text().split("\t")[0].strip().lower() == want:
                            return m
                except Exception:
                    continue
            return None

        _menu_log("press " + " > ".join(path), self.menu_state(window))
        if not self.cancel_menus(window):
            raise TriggerError("A Vectorworks menu is open and couldn't be closed, so its other menus can't be pressed.")
        last = len(path) - 1
        for i, name in enumerate(path):
            hit = None
            deadline = _t.monotonic() + open_wait
            while hit is None and _t.monotonic() < deadline:
                hit = find(name, top=(i == 0))
                if hit is None:
                    _t.sleep(0.15)
            where = ""
            with contextlib.suppress(Exception):
                where = f" at {hit.rectangle()} visible={hit.is_visible()}"
            _menu_log(f"level {i} {name!r}: {'found' + where if hit is not None else 'NOT found'}", self.menu_state(window) if hit is None else None)
            if hit is None:
                self.cancel_menus(window)
                raise TriggerError(f"Couldn't find '{name}' in Vectorworks' menus ({' > '.join(path)}).")
            if i < last:
                try:
                    hit.expand()
                except Exception:
                    hit.invoke()
                _t.sleep(0.3)
            elif i > 0 and self._click_by_message(window, hit):
                # Measured 2026-11-15: UI Automation's Invoke on an item in a submenu (File > Export
                # > Export PDF...) shows it pressed but runs nothing; a click posted to the
                # submenu's own window does (window messages: works on the lock screen too).
                _menu_log(f"clicked {name!r} by window message")
            else:
                try:
                    hit.invoke()
                except Exception:
                    pass  # Invoke gives up while the command's box is open; the press went through

    def _click_by_message(self, window, item) -> bool:
        """Post a mouse move, button down and button up to the menu popup window under `item`'s
        middle, at that point. False when no Vectorworks popup is there."""
        import ctypes

        u = ctypes.windll.user32  # type: ignore[attr-defined]
        r = item.rectangle()
        x, y = (r.left + r.right) // 2, (r.top + r.bottom) // 2

        class P(ctypes.Structure):
            _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

        class R(ctypes.Structure):
            _fields_ = [("l", ctypes.c_long), ("t", ctypes.c_long), ("r", ctypes.c_long), ("b", ctypes.c_long)]

        pid = ctypes.c_ulong()
        u.GetWindowThreadProcessId(window.handle, ctypes.byref(pid))
        hits: list[int] = []
        proto = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

        def each(h, _):
            p = ctypes.c_ulong()
            u.GetWindowThreadProcessId(h, ctypes.byref(p))
            if p.value == pid.value and u.IsWindowVisible(h) and u.GetClassLongW(h, -26) & 0x800:
                rr = R()
                u.GetWindowRect(h, ctypes.byref(rr))
                if rr.l <= x < rr.r and rr.t <= y < rr.b:
                    hits.append(h)
            return True

        u.EnumWindows(proto(each), 0)
        if not hits:
            return False
        h = hits[0]  # EnumWindows goes top-most first: the submenu over its parent menu
        # An MFC popup's items live in a child window (its CMFCPopupMenuBar): go down to the
        # deepest visible child under the point; that's the window that takes the click.
        for _ in range(6):
            cp = P(x, y)
            u.ScreenToClient(h, ctypes.byref(cp))
            child = u.ChildWindowFromPointEx(h, cp, 0x0001)  # CWP_SKIPINVISIBLE
            if not child or child == h:
                break
            h = child
        cls = ctypes.create_unicode_buffer(128)
        u.GetClassNameW(h, cls, 128)
        _menu_log(f"click goes to {h:#x} {cls.value!r}")
        pt = P(x, y)
        u.ScreenToClient(h, ctypes.byref(pt))
        lp = (pt.y & 0xFFFF) << 16 | (pt.x & 0xFFFF)
        u.PostMessageW(h, 0x0200, 0, lp)  # WM_MOUSEMOVE: highlight it
        time.sleep(0.15)
        u.PostMessageW(h, 0x0201, 1, lp)  # WM_LBUTTONDOWN
        u.PostMessageW(h, 0x0202, 0, lp)  # WM_LBUTTONUP
        return True

    def menu_state(self, window) -> dict:
        """What Windows can see of Vectorworks' menus right now (for menu.log)."""
        import ctypes

        out: dict = {}
        try:
            u = ctypes.windll.user32  # type: ignore[attr-defined]
            hm = u.GetMenu(window.handle)
            out["hmenu"] = bool(hm)
            if hm:
                names = []
                for k in range(u.GetMenuItemCount(hm)):
                    buf = ctypes.create_unicode_buffer(128)
                    u.GetMenuStringW(hm, k, buf, 128, 0x400)
                    names.append(buf.value)
                out["native_top"] = names
        except Exception as e:
            out["native_error"] = repr(e)
        try:
            from pywinauto import Desktop

            vw = Desktop(backend="uia").window(handle=window.handle)
            out["menubars"] = [[m.window_text() for m in bar.children()][:16] for bar in vw.descendants(control_type="MenuBar")]
            items = [m.window_text().split("\t")[0] for m in vw.descendants(control_type="MenuItem")]
            out["items"] = (len(items), items[:12])
            out["windows"] = [(w.window_text(), w.class_name()) for w in Desktop(backend="uia").windows(process=window.process_id())][:8]
        except Exception as e:
            out["uia_error"] = repr(e)
        return out

    def _menu_bar_names(self, window) -> list[str]:
        from pywinauto import Desktop

        vw = Desktop(backend="uia").window(handle=window.handle)
        names: list[str] = []
        for bar in vw.descendants(control_type="MenuBar"):
            names += [m.window_text().strip() for m in bar.children()]
        return names

    def _menus_closed(self, window, popups=None) -> bool:
        """No menu open: the open menu's own window (an MFC popup, measured on VW 2026: class
        "Afx:…:800:…" where the menu is drawn) is gone, and the top-level File item is listed again.
        UI Automation never shows Vectorworks' menu bar as a MenuBar, only as top-level items."""
        import ctypes

        try:
            u = ctypes.windll.user32  # type: ignore[attr-defined]
            if popups and any(u.IsWindowVisible(h) for h in popups):
                return False
            from pywinauto import Desktop

            vw = Desktop(backend="uia").window(handle=window.handle)
            names = {m.window_text().split("\t")[0].strip() for m in vw.descendants(control_type="MenuItem")}
            return "File" in names
        except Exception:
            return False

    def cancel_menus(self, window, wait: float = 1.5) -> str:
        """Close a menu left open (Vectorworks keeps Tools open after the job's menu press: its
        menu bar then drops out of UI Automation and nothing else on the menus can be pressed).
        Only window messages and UI Automation, no keys, so it works on the lock screen. Tries each
        way until the menu bar is back; returns which one did it ("" when none did)."""
        import ctypes
        import time as _t

        u = ctypes.windll.user32  # type: ignore[attr-defined]

        def popups() -> list[int]:
            """Vectorworks' open popup windows: an MFC menu's popup is one (class "Afx:…:800:…",
            style CS_SAVEBITS; not a #32768 Windows menu)."""
            found: list[int] = []
            pid = ctypes.c_ulong()
            u.GetWindowThreadProcessId(window.handle, ctypes.byref(pid))
            want = pid.value
            proto = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

            def each(h, _):
                p = ctypes.c_ulong()
                u.GetWindowThreadProcessId(h, ctypes.byref(p))
                # CS_SAVEBITS (0x800): menus and other short-lived popups; palettes don't have it
                if p.value == want and h != window.handle and u.IsWindowVisible(h) and u.GetClassLongW(h, -26) & 0x800:
                    found.append(h)
                return True

            u.EnumWindows(proto(each), 0)
            return found

        def describe(h) -> str:
            cls = ctypes.create_unicode_buffer(128)
            u.GetClassNameW(h, cls, 128)
            title = ctypes.create_unicode_buffer(128)
            u.GetWindowTextW(h, title, 128)

            class R(ctypes.Structure):
                _fields_ = [("l", ctypes.c_long), ("t", ctypes.c_long), ("r", ctypes.c_long), ("b", ctypes.c_long)]

            r = R()
            u.GetWindowRect(h, ctypes.byref(r))
            return f"{h:#x} {cls.value!r} {title.value!r} {r.l},{r.t},{r.r},{r.b}"

        def to_popups(*msgs):
            hs = popups()
            for h in hs:
                for m, w in msgs:
                    u.PostMessageW(h, m, w, 0)
            return hs

        open_now = popups()
        if not open_now and self._menus_closed(window):
            return "already closed"
        with contextlib.suppress(Exception):
            _menu_log("close menus: Vectorworks' other windows: " + "; ".join(describe(h) for h in open_now))
        ways = [
            ("cancel mode", lambda: u.SendMessageW(window.handle, 0x001F, 0, 0)),
            ("cancel mode to the menu's window", lambda: to_popups((0x001F, 0))),
            ("escape to the menu's window", lambda: to_popups((0x0100, 0x1B), (0x0101, 0x1B))),
            ("escape to Vectorworks", lambda: (u.PostMessageW(window.handle, 0x0100, 0x1B, 0), u.PostMessageW(window.handle, 0x0101, 0x1B, 0))),
        ]
        for name, way in ways:
            try:
                way()
            except Exception as e:
                _menu_log(f"close menus: {name} failed: {e!r}")
                continue
            deadline = _t.monotonic() + wait
            while _t.monotonic() < deadline:
                if self._menus_closed(window, open_now):
                    _menu_log(f"close menus: {name} worked")
                    return name
                _t.sleep(0.1)
        _menu_log("close menus: nothing worked", self.menu_state(window))
        return ""

    def title(self, window) -> str:
        return window.window_text() or ""

    def open_file(self, path, exe: str | None = None) -> None:
        open_with(path, exe)

    def capture_png(self, window) -> bytes:
        import io

        try:
            img = window.capture_as_image()  # needs Pillow
        except ImportError as e:
            raise TriggerError('Screenshots need Pillow: pip install "vwmcp[windows]"') from e
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()



def vectorworks_progids() -> list[str]:
    """Vectorworks' own registered file types for .vwx ("Vectorworks2026.Document" or the like),
    newest first, whatever app Windows has picked as the .vwx default."""
    try:
        import winreg
    except ImportError:
        return []
    names: set[str] = set()
    for root, key in (
        (winreg.HKEY_CLASSES_ROOT, r".vwx\OpenWithProgids"),
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.vwx\OpenWithProgids"),
    ):
        try:
            with winreg.OpenKey(root, key) as k:
                i = 0
                while True:
                    try:
                        names.add(winreg.EnumValue(k, i)[0])
                    except OSError:
                        break
                    i += 1
        except OSError:
            pass
    try:
        names.add(winreg.QueryValue(winreg.HKEY_CLASSES_ROOT, ".vwx"))
    except OSError:
        pass
    return sorted((n for n in names if n and "vectorworks" in n.lower()), reverse=True)


def open_with(path, exe: str | None = None) -> None:
    """Open a drawing in Vectorworks as a double-click on it would (Vectorworks' own file type, so
    the running copy takes it), from a short-lived helper process.

    Why a helper: Windows hands the file to a running Vectorworks over DDE, a conversation run on
    the calling thread. Called from the connector's worker thread, which never pumps messages, the
    conversation never finished and Vectorworks sat waiting on it: menus still opened but no
    command ran, MCP Run Job included, until the connector quit (seen 2026-11-11, from 12:40 on).
    The helper waits for DDE to finish and exits, which always ends the conversation.

    Never "whatever opens .vwx" first (Windows can have that set to a browser), never the path
    handed to Vectorworks2026.exe (a running copy makes an Untitled drawing and says "Encountered an
    improper argument"), and never with this connector's Python settings in the environment.
    `exe` is kept for callers; it isn't used to open."""
    import subprocess
    import sys

    progids = vectorworks_progids()
    try:
        done = subprocess.run(  # noqa: S603 - this Python, a fixed script, a file the user asked for
            [sys.executable, "-I", "-c", _OPEN_HELPER, str(path), *progids],
            env=clean_env_for_vectorworks(),
            timeout=120,
            capture_output=True,
            text=True,
        )
    except subprocess.TimeoutExpired as e:
        raise TriggerError(f"Windows took over 2 minutes to hand {Path(str(path)).name} to Vectorworks.") from e
    if done.returncode != 0:
        raise TriggerError(f"Windows couldn't open {Path(str(path)).name}: {(done.stderr or done.stdout).strip()[-300:]}")


# Run by open_with in its own process: ShellExecuteEx with Vectorworks' file type (else Windows'
# own choice), waiting for the DDE hand-over (SEE_MASK_NOASYNC) before exiting.
_OPEN_HELPER = r"""
import ctypes, os, sys
from ctypes import wintypes
class SEI(ctypes.Structure):
    _fields_ = [("cbSize", wintypes.DWORD), ("fMask", wintypes.ULONG), ("hwnd", wintypes.HWND),
                ("lpVerb", wintypes.LPCWSTR), ("lpFile", wintypes.LPCWSTR), ("lpParameters", wintypes.LPCWSTR),
                ("lpDirectory", wintypes.LPCWSTR), ("nShow", ctypes.c_int), ("hInstApp", wintypes.HINSTANCE),
                ("lpIDList", ctypes.c_void_p), ("lpClass", wintypes.LPCWSTR), ("hkeyClass", wintypes.HKEY),
                ("dwHotKey", wintypes.DWORD), ("hIcon", wintypes.HANDLE), ("hProcess", wintypes.HANDLE)]
path, progids = sys.argv[1], sys.argv[2:]
ctypes.windll.ole32.CoInitializeEx(None, 2)
for cls in progids + [None]:
    i = SEI(); i.cbSize = ctypes.sizeof(i); i.lpVerb = "open"; i.lpFile = path; i.nShow = 1
    i.fMask = 0x100 | 0x400 | (0x1 if cls else 0)  # NOASYNC | FLAG_NO_UI | CLASSNAME
    if cls:
        i.lpClass = cls
    if ctypes.windll.shell32.ShellExecuteExW(ctypes.byref(i)):
        sys.exit(0)
sys.exit("no program took the file (error %d)" % ctypes.GetLastError())
"""


# Set by this connector's own Python (its venv launcher sets __PYVENV_LAUNCHER__); a program it
# starts would inherit them, and an embedded Python like Vectorworks' can load the wrong one.
_PYTHON_ENV = ("__PYVENV_LAUNCHER__", "VIRTUAL_ENV", "CONDA_PREFIX", "CONDA_DEFAULT_ENV")


def clean_env_for_vectorworks() -> dict:
    """This process's environment without its Python settings, for a program it starts."""
    import os

    return {k: v for k, v in os.environ.items() if not (k.upper().startswith("PYTHON") or k.upper() in _PYTHON_ENV)}

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
        found = []
        for w in self.win.windows(self.title_re):
            exe = self.win.exe_name(w)
            if exe and self.process_re.search(exe):
                found.append(w)
            else:
                self._skipped.append(exe or "a program whose name couldn't be read")
        # Vectorworks can show more than one window with its name (a floating palette, a second
        # copy); the one with a drawing in its title is the one to work in.
        title = getattr(self.win, "title", None)
        if title and len(found) > 1:
            for w in found:
                try:
                    if self.has_drawing(title(w)):
                        return w
                except Exception:
                    pass
        return found[0] if found else None

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
        self.win.open_file(self.blank, self.vectorworks_exe(target))
        deadline = self._clock() + self.BLANK_WAIT_S
        while self._clock() < deadline:
            self._sleep(1.0)
            w = self.find_window()
            if w is not None and self.has_drawing(self.win.title(w)):
                self._sleep(2.0)  # let it finish opening before the keystroke
                return w
        seen = self.win.title(w) if (w := self.find_window()) is not None else "no Vectorworks window"
        raise TriggerError(
            f"Opened {self.blank.name} but Vectorworks didn't show it within a minute (its window says “{seen}”)."
            " If it opened in another app, .vwx files are set to open there: open it in Vectorworks by hand."
        )

    def vectorworks_exe(self, target=None) -> str | None:
        """The running Vectorworks program, so a file opens in it and not in whatever app Windows
        has .vwx set to (seen 2026-11-11: Windows handed the blank drawing to a Chromium window)."""
        try:
            w = target if target is not None else self.find_window()
            return getattr(self.win, "exe_path", lambda _w: None)(w) if w is not None else None
        except Exception:
            return None

    def _target(self):
        if getattr(self.win, "locked", lambda: False)():
            raise TriggerError(self.LOCKED)
        target = self.find_window()
        if target is None:
            raise self._not_found("")
        if self.win.process_age_s(target) < self.STARTUP_GRACE_S:
            raise TriggerError("Vectorworks only just started. Give it 30 seconds to settle, then try again.")
        if not self.win.enabled(target):
            raise self._dialog_error(target)
        return self._ensure_drawing(target)

    def _dialog_error(self, target) -> TriggerError:
        found = getattr(self.win, "pending_prompts", lambda w: [])(target)
        if found:
            p = found[0]
            said = p["text"] or p["title"]
            return TriggerError(
                f"Vectorworks is asking: \u201c{said}\u201d (buttons: {', '.join(p['buttons'])}). "
                "Answer it with answer_prompt (or from Rig Studio, or on the PC), then try again."
            )
        return TriggerError("Vectorworks has a dialog open. Close it, then try again.")

    def pending_prompt(self) -> dict | None:
        """The box Vectorworks is waiting on that the connector can't answer by itself, or None."""
        target = self.find_window()
        if target is None:
            return None
        found = getattr(self.win, "pending_prompts", lambda w: [])(target)
        return found[0] if found else None

    def answer_prompt(self, button: str, remember: bool = False) -> dict:
        """Press the designer's choice in that box; with remember, the same box is answered so
        from now on (~/.vwmcp/prompts.json)."""
        target = self.find_window()
        if target is None:
            raise self._not_found("")
        hit = getattr(self.win, "answer_prompt", lambda w, b: None)(target, button)
        if hit is None:
            raise TriggerError(f"Vectorworks isn't asking anything with a '{button}' button right now.")
        if remember:
            remember_prompt(prompt_phrase(hit["title"], hit["text"]), button)
        return hit

    def press_menu_path(self, path: list) -> None:
        """Press a command several menus down (see _Win32.press_menu_path)."""
        target = self.find_window()
        if target is None:
            raise self._not_found("")
        if not self.win.enabled(target):
            raise self._dialog_error(target)
        getattr(self.win, "press_menu_path")(target, path)

    def fill_export_dialogs(self, path: str) -> list[str]:
        """Answer the boxes a PDF export opens (see _Win32.fill_export_dialogs)."""
        target = self.find_window()
        if target is None:
            return []
        return getattr(self.win, "fill_export_dialogs", lambda w, p: [])(target, path)

    def tidy(self) -> None:
        """After a job: close the Tools menu the press left open (WM_CANCELMODE, no keys)."""
        with self._lock:
            target = self.find_window()
            if target is not None:
                getattr(self.win, "cancel_menus", lambda w: None)(target)

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
            raise self._dialog_error(target)
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
