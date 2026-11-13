"""The supervisor keeps Claude's one connection while the connector's code is swapped underneath."""

import json
import sys
import threading
import time
from pathlib import Path

import pytest

from vwmcp import supervisor

# A stand-in connector: answers the handshake with the code it was started from (code.py's text),
# "echo" with that code and its own process id, "slow" after a pause, and "die" by exiting.
CHILD = r'''
import json, os, sys, time
code = open(sys.argv[1]).read().strip()
for line in sys.stdin:
    m = json.loads(line)
    if "id" not in m:
        continue
    meth = m["method"]
    if meth == "die":
        sys.exit(3)
    if meth == "slow":
        time.sleep(float(m["params"]["s"]))
    res = {"capabilities": {"tools": {}}, "code": code} if meth == "initialize" else {"code": code, "pid": os.getpid()}
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": m["id"], "result": res}) + "\n")
    sys.stdout.flush()
'''


class Wire:
    def __init__(self):
        self.lines = []
        self.cv = threading.Condition()

    def write(self, b):
        with self.cv:
            self.lines.append(json.loads(b))
            self.cv.notify_all()

    def wait_for(self, pred, timeout=15):
        end = time.time() + timeout
        with self.cv:
            while True:
                for m in self.lines:
                    if pred(m):
                        return m
                left = end - time.time()
                if left <= 0:
                    raise AssertionError("never saw it; got %r" % self.lines)
                self.cv.wait(left)


@pytest.fixture
def sup(tmp_path, monkeypatch):
    monkeypatch.setattr(supervisor, "RESPAWN_GAP", 0.2)
    pkg = tmp_path / "pkg"
    pkg.mkdir()
    (pkg / "code.py").write_text("v1")
    script = tmp_path / "child.py"
    script.write_text(CHILD)
    wire = Wire()
    busy = tmp_path / "busy"
    busy.mkdir()
    s = supervisor.Supervisor([sys.executable, str(script), str(pkg / "code.py")], pkg, wire.write, busy=busy)
    assert s.start_child()
    stop = threading.Event()
    threading.Thread(target=s.watch, args=(stop, 0.05, 0.2), daemon=True).start()
    send = lambda m: s.from_claude((json.dumps(m) + "\n").encode())
    send({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {}})
    send({"jsonrpc": "2.0", "method": "notifications/initialized"})
    yield s, wire, send, pkg
    stop.set()
    s.stop()


def by_id(i):
    return lambda m: m.get("id") == i


def test_claude_is_told_the_tools_can_change(sup):
    s, wire, send, pkg = sup
    init = wire.wait_for(by_id(0))
    assert init["result"]["capabilities"]["tools"]["listChanged"] is True


def test_new_code_is_picked_up_without_dropping_the_connection(sup):
    s, wire, send, pkg = sup
    send({"jsonrpc": "2.0", "id": 1, "method": "echo"})
    first = wire.wait_for(by_id(1))["result"]
    (pkg / "code.py").write_text("v2")
    wire.wait_for(lambda m: m.get("method") == "notifications/tools/list_changed")
    send({"jsonrpc": "2.0", "id": 2, "method": "echo"})
    second = wire.wait_for(by_id(2))["result"]
    assert first["code"] == "v1" and second["code"] == "v2" and first["pid"] != second["pid"]
    # The replayed handshake's answer stayed with the supervisor; Claude saw one answer to its own.
    assert [m.get("id") for m in wire.lines].count(0) == 1
    assert not any(m.get("id") == supervisor.REINIT_ID for m in wire.lines)


def test_a_running_request_is_never_cut_off_by_new_code(sup):
    s, wire, send, pkg = sup
    send({"jsonrpc": "2.0", "id": 5, "method": "slow", "params": {"s": 1.2}})
    time.sleep(0.1)
    (pkg / "code.py").write_text("v2")
    done = wire.wait_for(by_id(5))
    assert "result" in done and done["result"]["code"] == "v1", "answered by the code it started on"
    wire.wait_for(lambda m: m.get("method") == "notifications/tools/list_changed")
    send({"jsonrpc": "2.0", "id": 6, "method": "echo"})
    assert wire.wait_for(by_id(6))["result"]["code"] == "v2"


def test_a_vectorworks_job_running_in_the_background_holds_new_code_back(sup):
    """A Rig Studio read-out runs inside the connector, not as one of Claude's requests: its job
    mark keeps the old code serving until it's done."""
    s, wire, send, pkg = sup
    wire.wait_for(by_id(0))
    mark = s.busy / "job1"
    mark.write_text("read_out")
    (pkg / "code.py").write_text("v2")
    time.sleep(0.8)
    assert not any(m.get("method") == "notifications/tools/list_changed" for m in wire.lines), "swapped mid-job"
    mark.unlink()
    wire.wait_for(lambda m: m.get("method") == "notifications/tools/list_changed")


def test_a_job_marks_itself_busy_while_it_runs(tmp_path):
    import asyncio

    from vwmcp.jobs import BUSY_DIR, JobQueue

    class S:
        home = tmp_path
        jobs_dir = tmp_path / "jobs"
        results_dir = tmp_path / "results"
        timeout = 5.0
        refire_after = 99.0
        hotkey = "x"

    seen = []

    class T:
        def fire(self, *a):
            seen.append([p.name for p in (tmp_path / BUSY_DIR).iterdir()])
            job = next((tmp_path / "jobs").glob("*.json"))
            (tmp_path / "results" / job.name).write_text(json.dumps({"ok": True, "result": 1}))
            job.unlink()

    assert asyncio.run(JobQueue(S(), T()).call("ping")) == 1
    assert len(seen[0]) == 1, "marked while running"
    assert list((tmp_path / BUSY_DIR).iterdir()) == [], "and cleared after"


def test_a_child_that_dies_is_started_again_and_its_request_gets_an_error(sup):
    s, wire, send, pkg = sup
    wire.wait_for(by_id(0))
    send({"jsonrpc": "2.0", "id": 7, "method": "die"})
    err = wire.wait_for(by_id(7))
    assert "restarted" in err["error"]["message"]
    send({"jsonrpc": "2.0", "id": 8, "method": "echo"})
    assert wire.wait_for(by_id(8))["result"]["code"] == "v1"


def test_main_runs_supervised_unless_turned_off(monkeypatch):
    from vwmcp import server

    monkeypatch.delenv("VWMCP_SUPERVISE", raising=False)
    assert server.supervised()
    monkeypatch.setenv("VWMCP_SUPERVISE", "0")
    assert not server.supervised()


def test_only_the_package_files_are_watched(tmp_path):
    (tmp_path / "a.py").write_text("x")
    (tmp_path / "notes.txt").write_text("x")
    assert list(supervisor.snapshot(tmp_path)) == ["a.py"]
