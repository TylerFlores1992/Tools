"""The Windows hotkey trigger's decisions, with Windows itself faked out."""

import json
import pytest

from vwmcp.trigger import HotkeyTrigger, TriggerError

VW, BROWSER = 100, 200


class FakeWindow:
    def __init__(self, handle=VW, exe="Vectorworks2026.exe"):
        self.handle, self.exe = handle, exe

    def is_minimized(self):
        return False


class FakeWin:
    """Scripted Windows: who's in front, how long since input, mouse held, dialog open..."""

    def __init__(self, foreground=BROWSER, idle=[5000], held=[False], age=600.0, enabled=True, window=True, front=()):
        self.fg = foreground
        self.idle_seq, self.held_seq = list(idle), list(held)
        self.age, self.is_enabled = age, enabled
        # Windows whose title matches, front to back: `front` ones first, then Vectorworks itself.
        self.titled = list(front) + ([FakeWindow()] if window else [])
        self.log = []

    def windows(self, title_re):
        return list(self.titled)

    def exe_name(self, w):
        return w.exe

    def process_age_s(self, w):
        return self.age

    def enabled(self, w):
        return self.is_enabled

    def foreground(self):
        return self.fg

    def idle_ms(self):
        return self.idle_seq.pop(0) if len(self.idle_seq) > 1 else self.idle_seq[0]

    def input_held(self):
        return self.held_seq.pop(0) if len(self.held_seq) > 1 else self.held_seq[0]

    def focus(self, w):
        self.log.append("focus vw" if w.handle == VW else f"focus {w.handle}")
        self.fg = w.handle

    def focus_hwnd(self, h):
        self.log.append(f"focus {h}")
        self.fg = h

    def send_keys(self, k):
        self.log.append(f"keys {k}")

    def capture_png(self, w):
        return b"\x89PNG"


class Clock:
    def __init__(self):
        self.t = 1000.0

    def wall(self):
        return self.t

    def __call__(self):
        return self.t

    def sleep(self, s):
        self.t += s


def make(win, **kw):
    clock = Clock()
    return HotkeyTrigger("^+%m", ".*Vectorworks.*", win=win, sleep=clock.sleep, clock=clock, wall=clock.wall, **kw), clock


def test_from_another_app_it_fires_at_once_and_gives_focus_back():
    win = FakeWin(foreground=BROWSER, idle=[10])  # just clicked in the browser: doesn't matter
    t, _ = make(win)
    t.fire()
    assert win.log == ["focus vw", "keys ^+%m", f"focus {BROWSER}"]


def test_while_you_work_in_vectorworks_it_waits_for_a_pause():
    # Mouse held for 3 polls (mid-drag), then released but busy, then idle long enough.
    win = FakeWin(foreground=VW, held=[True, True, True, False], idle=[0, 0, 0, 100, 300, 700])
    t, clock = make(win, idle_ms=600)
    start = clock.t
    t.fire()
    assert "keys ^+%m" in win.log
    assert clock.t - start >= 0.4  # it actually waited
    assert win.log[-1] == "keys ^+%m"  # focus was already Vectorworks: nothing to hand back


def test_a_person_busy_for_ages_doesnt_stall_claude_forever():
    win = FakeWin(foreground=VW, held=[True])
    t, clock = make(win, idle_max_s=5)
    t.fire()
    assert "keys ^+%m" in win.log


def test_refuses_with_a_dialog_open_or_just_after_launch_or_no_window():
    with pytest.raises(TriggerError, match="dialog open"):
        make(FakeWin(enabled=False))[0].fire()
    with pytest.raises(TriggerError, match="only just started"):
        make(FakeWin(age=12))[0].fire()
    with pytest.raises(TriggerError, match="No Vectorworks window"):
        make(FakeWin(window=False))[0].fire()


def test_jobs_written_before_a_press_ride_along_with_it():
    win = FakeWin()
    t, clock = make(win)
    a = b = clock.t  # two requests arrive together
    t.fire(a)
    t.fire(b)  # waited for the lock; its job was already on disk when the key went down
    assert win.log.count("keys ^+%m") == 1
    t.fire(clock.t + 0.01)  # written after that press: needs its own
    assert win.log.count("keys ^+%m") == 2
    t.fire()  # the queue's re-press for a lost key always goes through
    assert win.log.count("keys ^+%m") == 3


def test_screenshot_brings_vectorworks_forward_first():
    win = FakeWin()
    t, _ = make(win)
    assert t.capture_png() == b"\x89PNG" and win.log == ["focus vw"]


# ---- which window counts as Vectorworks --------------------------------------------------


def test_a_browser_tab_titled_vectorworks_is_never_pressed():
    """The panel page's tab reads "Vectorworks - Cyber Wolf". Chrome is in front of Vectorworks."""
    win = FakeWin(front=[FakeWindow(handle=BROWSER, exe="chrome.exe")])
    trig, _ = make(win)
    trig.fire()
    # Vectorworks is focused and pressed; Chrome only gets focus back afterwards.
    assert win.log[:2] == ["focus vw", "keys ^+%m"]


def test_no_vectorworks_program_means_not_found_and_names_what_it_saw():
    win = FakeWin(window=False, front=[FakeWindow(handle=BROWSER, exe="chrome.exe"), FakeWindow(handle=300, exe=None)])
    with pytest.raises(TriggerError, match="chrome.exe") as e:
        make(win)[0].fire()
    assert "couldn't be read" in str(e.value) and "VWMCP_PROCESS_RE" in str(e.value)
    assert not any(line.startswith("keys") for line in win.log)


def test_a_program_name_that_cant_be_read_never_counts():
    win = FakeWin(window=False, front=[FakeWindow(handle=300, exe=None)])
    with pytest.raises(TriggerError, match="No Vectorworks window"):
        make(win)[0].fire()


def test_the_default_program_rule():
    import re

    from vwmcp.trigger import DEFAULT_PROCESS_RE

    rule = re.compile(DEFAULT_PROCESS_RE)
    for exe in ["Vectorworks2026.exe", "VECTORWORKS2026.EXE", "Vectorworks.exe"]:
        assert rule.search(exe), exe
    for exe in ["chrome.exe", "msedge.exe", "explorer.exe", "Vectorworks2026.exe.bak", "notvectorworks.exe"]:
        assert not rule.search(exe), exe


def test_config_and_trigger_share_one_default(monkeypatch):
    from vwmcp import config
    from vwmcp.trigger import DEFAULT_PROCESS_RE

    monkeypatch.delenv("VWMCP_PROCESS_RE", raising=False)
    assert config.load().process_re == DEFAULT_PROCESS_RE


# ---- the lock screen and "Vectorworks with no drawing" (2026-11-10) -------------------------


class TitledWin(FakeWin):
    def __init__(self, titles, locked=False, **kw):
        super().__init__(**kw)
        self.titles, self.is_locked, self.opened = list(titles), locked, []

    def locked(self):
        return self.is_locked

    def title(self, w):
        return self.titles.pop(0) if len(self.titles) > 1 else self.titles[0]

    def open_file(self, path, exe=None):
        self.opened.append(str(path))
        self.opened_with = exe

    def exe_path(self, w):
        return "C:\\Program Files\\Vectorworks 2026\\" + w.exe


def test_a_locked_pc_says_so_and_sends_nothing():
    win = TitledWin(["Vectorworks Design Suite 2026 - [Show.vwx]"], locked=True)
    t, _ = make(win)
    with pytest.raises(TriggerError, match="lock screen"):
        t.fire()
    assert not any(e.startswith("keys") for e in win.log)


def test_the_title_tells_a_drawing_from_none():
    assert not HotkeyTrigger.has_drawing("Vectorworks Design Suite 2026")
    assert not HotkeyTrigger.has_drawing("Vectorworks 2026")
    assert HotkeyTrigger.has_drawing("Vectorworks Design Suite 2026 - [CFF-26_041426_v2025.vwx]")
    assert HotkeyTrigger.has_drawing("Untitled1 - Vectorworks")
    assert HotkeyTrigger.has_drawing("Something unexpected")  # unknown counts as a drawing: never open over one


def test_no_drawing_opens_the_blank_one_then_presses(tmp_path):
    blank = tmp_path / "Claude connector.vwx"
    blank.write_bytes(b"vwx")
    win = TitledWin(["Vectorworks Design Suite 2026", "Vectorworks Design Suite 2026", "Vectorworks Design Suite 2026 - [Claude connector.vwx]"])
    t, _ = make(win, blank=blank)
    t.fire()
    assert win.opened == [str(blank)]
    assert any(e.startswith("keys") for e in win.log)
    assert win.opened_with == r"C:\Program Files\Vectorworks 2026\Vectorworks2026.exe", "opened by the running Vectorworks, not by whatever app .vwx is set to"


def test_a_drawing_already_open_is_left_alone(tmp_path):
    blank = tmp_path / "Claude connector.vwx"
    blank.write_bytes(b"vwx")
    win = TitledWin(["Vectorworks Design Suite 2026 - [Show.vwx]"])
    t, _ = make(win, blank=blank)
    t.fire()
    assert win.opened == []


def test_no_drawing_and_no_blank_explains_what_to_do(tmp_path):
    win = TitledWin(["Vectorworks Design Suite 2026"])
    t, _ = make(win, blank=tmp_path / "missing.vwx")
    with pytest.raises(TriggerError, match="no drawing"):
        t.fire()
    assert win.opened == []


# ---- the menu trigger: no keys, works on a locked PC (measured 2026-11-10) ------------------

from vwmcp.trigger import MenuTrigger  # noqa: E402


class MenuWin(TitledWin):
    def __init__(self, titles=("Vectorworks Design Suite 2026 - [Show.vwx]",), menu_ok=True, **kw):
        super().__init__(list(titles), **kw)
        self.menu_ok = menu_ok

    def press_menu(self, w, menu, item):
        self.log.append(f"menu {menu} > {item}")
        if not self.menu_ok:
            raise TriggerError("menu not reachable")


def make_menu(win, **kw):
    clock = Clock()
    return MenuTrigger("^+%m", ".*Vectorworks.*", win=win, sleep=clock.sleep, clock=clock, wall=clock.wall, **kw), clock


def test_the_menu_trigger_presses_the_menu_and_no_keys():
    win = MenuWin()
    t, _ = make_menu(win)
    t.fire()
    assert win.log == ["menu Tools > MCP Run Job"]


def test_on_a_locked_pc_the_menu_still_works():
    win = MenuWin(locked=True)
    t, _ = make_menu(win)
    t.fire()
    assert win.log == ["menu Tools > MCP Run Job"]


def test_locked_and_the_menu_fails_says_so_without_trying_keys():
    win = MenuWin(locked=True, menu_ok=False)
    t, _ = make_menu(win)
    with pytest.raises(TriggerError, match="locked PC"):
        t.fire()
    assert not any(e.startswith("keys") for e in win.log)


def test_unlocked_and_the_menu_fails_falls_back_to_the_shortcut():
    win = MenuWin(menu_ok=False)
    t, _ = make_menu(win)
    t.fire()
    assert win.log[0] == "menu Tools > MCP Run Job" and "keys ^+%m" in win.log


def test_the_menu_trigger_opens_the_blank_drawing_first_when_none_is_open(tmp_path):
    blank = tmp_path / "Claude connector.vwx"
    blank.write_bytes(b"vwx")
    win = MenuWin(titles=["Vectorworks Design Suite 2026", "Vectorworks Design Suite 2026 - [Claude connector.vwx]"], locked=True)
    t, _ = make_menu(win, blank=blank)
    t.fire()
    assert win.opened == [str(blank)] and win.log[-1] == "menu Tools > MCP Run Job"


def test_menu_is_the_default_trigger(monkeypatch):
    from vwmcp import config
    from vwmcp.trigger import make_trigger

    monkeypatch.delenv("VWMCP_TRIGGER", raising=False)
    s = config.load()
    assert s.trigger == "menu" and isinstance(make_trigger(s), MenuTrigger)


def test_a_convert_prompt_is_accepted_before_pressing_the_menu():
    class PromptWin(MenuWin):
        def __init__(self):
            super().__init__()
            self.prompt = True

        def accept_prompts(self, w):
            if self.prompt:
                self.prompt = False
                self.log.append("accepted convert prompt")
                return ["created with an older version of vectorworks"]
            return []

    win = PromptWin()
    t, _ = make_menu(win)
    t.fire()
    assert win.log == ["accepted convert prompt", "menu Tools > MCP Run Job"]


# ---- answering prompts and closing converted copies ----

BACKUP_BOX = (
    "30 minutes have elapsed since the first operation was performed on this document, but a backup "
    "copy cannot be created until this document has been named and saved. Do you want to name and "
    "save this document now, and have a backup copy created?"
)


def test_the_30_minute_backup_box_gets_no_and_stop_asking():
    from vwmcp.trigger import pick_prompt

    p = pick_prompt(BACKUP_BOX)
    assert p is not None and p.buttons == ("No",) and "don't back up" in p.tick
    convert = pick_prompt("This file was created with an older version of Vectorworks and will be converted.")
    assert convert is not None and convert.buttons == ("OK",)
    assert pick_prompt("Are you sure you want to delete these objects?") is None  # unknown: left alone


def test_save_changes_is_discarded_only_for_the_named_copy():
    from vwmcp.trigger import is_save_prompt_for

    copy = "CFF-26_041426_v2025_v2026.vwx"
    assert is_save_prompt_for("Save changes to \u201cCFF-26_041426_v2025_v2026\u201d?", copy)
    assert not is_save_prompt_for("Save changes to \u201cRealShow\u201d?", copy)  # someone's own drawing
    assert not is_save_prompt_for("CFF-26_041426_v2025_v2026 is read-only.", copy)  # not a save prompt
    assert not is_save_prompt_for("Save changes?", "")


class CloseWin(MenuWin):
    def accept_prompts(self, w):
        self.log.append("prompts")
        return []

    def discard_copy(self, w, name):
        self.log.append(f"discard {name}")
        self.titles = ["Vectorworks Design Suite 2026 - [Claude connector.vwx]"]
        return True


def test_the_converted_copy_is_closed_without_saving_when_it_is_in_front():
    win = CloseWin(titles=["Vectorworks Design Suite 2026 - [CFF-26_041426_v2025_v2026.vwx]"])
    t, _ = make_menu(win)
    assert t.close_copy("CFF-26_041426_v2025_v2026.vwx") is True
    assert win.log == ["prompts", "menu File > Close", "discard CFF-26_041426_v2025_v2026.vwx"]


def test_a_different_drawing_in_front_is_never_closed():
    win = CloseWin(titles=["Vectorworks Design Suite 2026 - [RealShow.vwx]"])
    t, _ = make_menu(win)
    assert t.close_copy("CFF-26_041426_v2025_v2026.vwx") is False
    assert win.log == []


def test_a_menu_press_that_times_out_while_vectorworks_runs_the_job_counts_as_pressed(monkeypatch):
    """UI Automation's Invoke waits for the command; a long job makes it raise although the press
    went through (measured 2026-11-10 on CFF-26 read-outs). That's not a failed press."""
    import sys
    import types

    from vwmcp.trigger import _Win32

    pressed = []

    class Item:
        def __init__(self, text):
            self.text = text

        def window_text(self):
            return self.text

        def invoke(self):
            pressed.append(self.text)
            raise TimeoutError("COM call timed out")  # Vectorworks is busy running it

    class Win:
        def descendants(self, control_type=None):
            return [Item("MCP Run Job\tCtrl+Shift+Alt+M")] if control_type == "MenuItem" else []

    class Desktop:
        def __init__(self, backend=None):
            pass

        def window(self, handle=None):
            return Win()

    monkeypatch.setitem(sys.modules, "pywinauto", types.SimpleNamespace(Desktop=Desktop))
    w = _Win32.__new__(_Win32)
    w.press_menu(types.SimpleNamespace(handle=1), "Tools", "MCP Run Job")  # doesn't raise
    assert pressed == ["MCP Run Job\tCtrl+Shift+Alt+M"]


def test_the_font_mapping_box_gets_ok():
    """Measured 2026-11-11 opening the Bili Bili rigging file: "Font Mapping" (Bank Gothic -> Arial)
    stopped the open; read_out gave up after 3 minutes. OK keeps Vectorworks' suggested fonts."""
    from vwmcp.trigger import pick_prompt

    p = pick_prompt("Font Mapping Replace: With: For Help, press F1 or click the ? icon.")
    assert p is not None and p.buttons == ("OK",)


# ---- boxes the connector doesn't know: passed on, answered, remembered ----


def test_common_boxes_from_someone_elses_drawing_get_the_answer_that_changes_nothing():
    from vwmcp.trigger import pick_prompt

    assert pick_prompt("The referenced file 'X.vwx' could not be found. Would you like to locate it?").buttons[0] == "No"
    assert pick_prompt("Some plug-in objects could not be found and will be shown as boxes.").buttons[0] == "OK"
    assert pick_prompt("Show.vwx is in use by Dana. Open it read-only?").buttons[0] == "Open Read-Only"
    assert pick_prompt("Update all references now?") is None, "a real choice is asked, not guessed"


def test_an_answer_the_designer_chose_is_remembered_for_the_same_box(tmp_path, monkeypatch):
    from vwmcp import trigger as tr

    monkeypatch.setattr(tr, "LEARNED_FILE", tmp_path / "prompts.json")
    msg = 'The texture "Brick 4" in C:\\Libs\\a.vwx is out of date (12 items). Refresh it?'
    phrase = tr.prompt_phrase("Textures", msg)
    assert "brick" not in phrase and "12" not in phrase and "\\\\" not in phrase, "names and numbers change file to file"
    assert tr.pick_prompt(msg) is None
    tr.remember_prompt(phrase, "Not Now")
    other = 'The texture "Oak" in D:\\x\\b.vwx is out of date (3 items). Refresh it?'
    hit = tr.pick_prompt(other)
    assert hit is not None and hit.buttons == ("Not Now",), "the same box in another file is answered the same way"
    tr.remember_prompt("ok", "OK")
    assert len(json.loads((tmp_path / "prompts.json").read_text())) == 1, "too short to tell boxes apart: not kept"


class AskingWin(MenuWin):
    box = {"title": "Missing Things", "text": "Some things are missing.", "buttons": ["Skip", "Locate"]}

    def __init__(self, **kw):
        super().__init__(**kw)
        self.open_box = True

    def enabled(self, w):
        return not self.open_box

    def pending_prompts(self, w):
        return [self.box] if self.open_box else []

    def answer_prompt(self, w, button):
        if self.open_box and button in self.box["buttons"]:
            self.open_box = False
            self.log.append(f"pressed {button}")
            return self.box
        return None


def test_a_box_it_doesnt_know_is_said_and_can_be_answered(tmp_path, monkeypatch):
    from vwmcp import trigger as tr

    monkeypatch.setattr(tr, "LEARNED_FILE", tmp_path / "prompts.json")
    win = AskingWin()
    t, _ = make_menu(win)
    try:
        t.fire()
        raise AssertionError("fired through a box")
    except TriggerError as e:
        assert "Some things are missing." in str(e) and "Skip, Locate" in str(e), "the error says what Vectorworks asks"
    assert t.pending_prompt() == win.box
    try:
        t.answer_prompt("Delete")
        raise AssertionError("pressed a button the box doesn't have")
    except TriggerError:
        pass
    t.answer_prompt("Skip", remember=True)
    assert win.log[-1] == "pressed Skip" and t.pending_prompt() is None
    assert tr.pick_prompt("Some things are missing.").buttons == ("Skip",)


def test_files_open_from_a_helper_process_as_vectorworks_files(monkeypatch, tmp_path):
    """A running Vectorworks takes the file over DDE; done on the connector's own thread, the
    conversation never ended and Vectorworks stopped running commands. So: a helper that exits."""
    import subprocess
    import sys

    from vwmcp import trigger as trig

    ran = []
    monkeypatch.setattr(trig, "vectorworks_progids", lambda: ["Vectorworks2026.Document"])
    monkeypatch.setattr(subprocess, "run", lambda args, **kw: ran.append((args, kw)) or subprocess.CompletedProcess(args, 0, "", ""))
    monkeypatch.setenv("__PYVENV_LAUNCHER__", "C:\\vwmcp\\.venv\\Scripts\\python.exe")
    monkeypatch.setenv("VWMCP_HOME", "keep")
    trig.open_with(tmp_path / "Show.vwx", r"C:\VW\Vectorworks2026.exe")
    (args, kw), = ran
    assert args[0] == sys.executable and args[3] == trig._OPEN_HELPER, "its own process, not this thread"
    assert args[4:] == [str(tmp_path / "Show.vwx"), "Vectorworks2026.Document"], "Vectorworks' own file type"
    assert "0x100" in trig._OPEN_HELPER, "it waits for the hand-over to finish before exiting"
    assert "__PYVENV_LAUNCHER__" not in kw["env"] and kw["env"]["VWMCP_HOME"] == "keep"
    assert not any("Vectorworks2026.exe" in a for a in args), "never the path handed to the program"


def test_a_file_windows_wont_open_says_so(monkeypatch, tmp_path):
    import subprocess

    from vwmcp import trigger as trig

    monkeypatch.setattr(trig, "vectorworks_progids", lambda: [])
    monkeypatch.setattr(subprocess, "run", lambda args, **kw: subprocess.CompletedProcess(args, 1, "", "no program took the file (error 1155)"))
    with pytest.raises(TriggerError, match="couldn't open Show.vwx: no program took the file"):
        trig.open_with(tmp_path / "Show.vwx")


def test_the_vectorworks_window_with_a_drawing_is_the_one_used():
    palette, main = FakeWindow(handle=7), FakeWindow(handle=8)
    win = FakeWin(window=False, front=(palette, main))
    win.title = lambda w: "Vectorworks Design Suite 2026" if w is palette else "Vectorworks Design Suite 2026 - [CFF.vwx]"
    t, _ = make(win)
    assert t.find_window() is main


def test_error_boxes_are_never_answered_by_themselves(tmp_path, monkeypatch):
    from vwmcp import trigger as trig

    monkeypatch.setattr(trig, "LEARNED_FILE", tmp_path / "prompts.json")
    trig.remember_prompt("Encountered an improper argument.", "OK")
    assert not (tmp_path / "prompts.json").exists(), "an error box isn't learned"
    (tmp_path / "prompts.json").write_text('[{"phrase": "encountered an improper argument.", "buttons": ["OK"]}]')
    assert trig.learned_prompts() == [], "one learned before this rule is ignored"
