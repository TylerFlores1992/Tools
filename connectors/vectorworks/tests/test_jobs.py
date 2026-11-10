"""The job queue keeps waiting when a re-press fails (Vectorworks busy with the job it already got)."""

import asyncio
import json
import threading
import time

import pytest

from vwmcp import config
from vwmcp.jobs import BridgeTimeout, JobQueue
from vwmcp.trigger import TriggerError


class BusyTrigger:
    """The first press gets through; every press after it can't find the window (Vectorworks is
    "Not Responding" while it starts a big job)."""

    def __init__(self, settings, answer_after: float | None):
        self.settings, self.answer_after, self.presses = settings, answer_after, 0

    def fire(self, job_created=None):
        self.presses += 1
        if self.presses == 1:
            if self.answer_after is not None:
                threading.Thread(target=self._vectorworks, daemon=True).start()
            return
        raise TriggerError("No Vectorworks window found. Is Vectorworks open with a drawing?")

    def _vectorworks(self):
        time.sleep(self.answer_after)  # slow to claim the job: the queue presses again meanwhile
        for job in self.settings.jobs_dir.glob("*.json"):
            data = json.loads(job.read_text())
            job.unlink()
            (self.settings.results_dir / job.name).write_text(json.dumps({"id": data["id"], "ok": True, "result": {"done": True}}))


@pytest.fixture
def settings(tmp_path, monkeypatch):
    monkeypatch.setenv("VWMCP_HOME", str(tmp_path))
    monkeypatch.setenv("VWMCP_REFIRE_AFTER", "0.1")
    monkeypatch.setenv("VWMCP_TIMEOUT", "3")
    return config.load()


def test_a_failed_re_press_does_not_drop_a_job_vectorworks_is_running(settings):
    trig = BusyTrigger(settings, answer_after=0.6)
    q = JobQueue(settings, trig, poll_interval=0.02)
    assert asyncio.run(q.call("read_out")) == {"done": True}
    assert trig.presses >= 2  # it did press again, and those presses failed


def test_a_job_never_picked_up_says_why_the_press_failed(settings):
    trig = BusyTrigger(settings, answer_after=None)
    q = JobQueue(settings, trig, poll_interval=0.02)
    with pytest.raises(BridgeTimeout, match="No Vectorworks window found"):
        asyncio.run(q.call("ping", _timeout=0.5))
