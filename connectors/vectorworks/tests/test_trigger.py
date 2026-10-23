"""The Windows hotkey trigger's decisions, with Windows itself faked out."""

import pytest

from vwmcp.trigger import HotkeyTrigger, TriggerError

VW, BROWSER = 100, 200


class FakeWindow:
    handle = VW

    def is_minimized(self):
        return False


class FakeWin:
    """Scripted Windows: who's in front, how long since input, mouse held, dialog open..."""

    def __init__(self, foreground=BROWSER, idle=[5000], held=[False], age=600.0, enabled=True, window=True):
        self.fg = foreground
        self.idle_seq, self.held_seq = list(idle), list(held)
        self.age, self.is_enabled = age, enabled
        self.window = FakeWindow() if window else None
        self.log = []

    def find_window(self, title_re):
        return self.window

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
        self.log.append("focus vw")
        self.fg = VW

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
