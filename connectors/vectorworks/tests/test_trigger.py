"""The Windows hotkey trigger's decisions, with Windows itself faked out."""

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
