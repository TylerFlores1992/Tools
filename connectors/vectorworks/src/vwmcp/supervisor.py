"""Keeps one MCP connection to Claude while the connector's code is replaced underneath it.

The Claude app starts `vwmcp.exe` once and talks to it over stdin/stdout for the whole session, so
new connector code (server, trigger, jobs, read-out) used to need the app restarted. This small
process sits in between: it runs the real server as a child, passes every line both ways, and when
a file in the package changes it waits until no request is running, starts a fresh child, repeats
Claude's opening handshake to it (keeping the child's answer to itself) and tells Claude the tool
list may have changed. A child that dies is started again the same way; requests it was answering
get an error that says so. Claude never sees the connection drop.

Only the standard library, and nothing here changes often: this file itself is the one piece that
still needs the app restarted (or an update) to change. Set VWMCP_SUPERVISE=0 to run the server
directly, as before.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Callable, Optional

REINIT_ID = "vwmcp-supervisor-reinit"
# How often the package files are checked, and how long they must sit unchanged before a restart
# (an update or a deploy writes several files one after another).
POLL = 1.0
SETTLE = 1.5
# A child that keeps dying is started again at most this often.
RESPAWN_GAP = 5.0
# How long a fresh child may take to answer the replayed handshake.
REINIT_WAIT = 60.0


def _log(msg: str) -> None:
    print("vwmcp supervisor: %s" % msg, file=sys.stderr, flush=True)


def snapshot(root: Path) -> dict:
    """Modification times of the package's Python files (the bridge reloads itself; not here)."""
    out = {}
    for p in sorted(root.glob("*.py")):
        try:
            out[p.name] = p.stat().st_mtime_ns
        except OSError:
            pass
    return out


class Supervisor:
    def __init__(self, cmd: list, root: Path, out: Callable[[bytes], None], env: Optional[dict] = None, busy: Optional[Path] = None):
        self.cmd = cmd
        self.busy = busy  # a folder the connector puts a file in for each Vectorworks job running
        self.root = root
        self._write_out = out
        self.env = env
        self.lock = threading.RLock()
        self.child: Optional[subprocess.Popen] = None
        self.generation = 0
        self.init_req: Optional[bytes] = None
        self.initialized: Optional[bytes] = None
        self.pending: dict = {}  # Claude's request ids the child hasn't answered: id -> method
        self.held: list = []  # lines from Claude while no child can take them
        self.ready = False  # the current child has had the handshake (or is the first one)
        self.restarts = 0
        self.closed = False
        self.reinit_done = threading.Event()
        self.last_start = 0.0
        self.last_error = ""

    # ---- both directions -------------------------------------------------------------------

    def send_out(self, obj_or_line) -> None:
        line = obj_or_line if isinstance(obj_or_line, bytes) else (json.dumps(obj_or_line) + "\n").encode()
        with self.lock:
            self._write_out(line)

    def _to_child(self, line: bytes) -> bool:
        c = self.child
        if c is None or c.poll() is not None or c.stdin is None:
            return False
        try:
            c.stdin.write(line)
            c.stdin.flush()
            return True
        except (OSError, ValueError):
            return False

    def from_claude(self, line: bytes) -> None:
        """One line from Claude: remembered if it's the handshake, then passed on (or held)."""
        try:
            msg = json.loads(line)
        except ValueError:
            msg = None
        with self.lock:
            if isinstance(msg, dict):
                method = msg.get("method")
                if method == "initialize" and "id" in msg:
                    self.init_req = line
                elif method == "notifications/initialized":
                    self.initialized = line
                if method and "id" in msg:
                    self.pending[json.dumps(msg["id"])] = method
            if not self.ready or not self._to_child(line):
                self.held.append(line)
                if self.ready:  # the child just died; the watcher starts another
                    self.ready = False

    def from_child(self, line: bytes, generation: int) -> None:
        """One line from a child: its answer to the replayed handshake stays here; the first
        answer to Claude's own handshake says the tool list can change; everything else goes on."""
        try:
            msg = json.loads(line)
        except ValueError:
            msg = None
        with self.lock:
            if generation != self.generation:
                return  # an old child's last words
            if isinstance(msg, dict) and "id" in msg and "method" not in msg:
                if msg["id"] == REINIT_ID:
                    self.reinit_done.set()
                    return
                key = json.dumps(msg["id"])
                if self.pending.pop(key, None) == "initialize" and isinstance(msg.get("result"), dict):
                    caps = msg["result"].setdefault("capabilities", {})
                    tools = caps.get("tools") if isinstance(caps.get("tools"), dict) else {}
                    tools["listChanged"] = True
                    caps["tools"] = tools
                    line = (json.dumps(msg) + "\n").encode()
            self.send_out(line)

    # ---- the child ---------------------------------------------------------------------------

    def _pump(self, child: subprocess.Popen, generation: int) -> None:
        assert child.stdout is not None
        for line in iter(child.stdout.readline, b""):
            self.from_child(line, generation)

    def start_child(self) -> bool:
        """Start a child; for every child after Claude's own handshake, repeat that handshake to
        it first. True when it is ready for Claude's lines."""
        self.last_start = time.monotonic()
        kw = {"creationflags": 0x08000000} if os.name == "nt" else {}  # CREATE_NO_WINDOW
        try:
            child = subprocess.Popen(self.cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, env=self.env, **kw)
        except OSError as e:
            self.last_error = str(e)
            _log("couldn't start the connector: %s" % e)
            return False
        with self.lock:
            self.generation += 1
            gen = self.generation
            self.child = child
            self.reinit_done.clear()
        threading.Thread(target=self._pump, args=(child, gen), daemon=True).start()
        with self.lock:
            init, done = self.init_req, self.initialized
        if init is not None:
            req = json.loads(init)
            req["id"] = REINIT_ID
            self._to_child((json.dumps(req) + "\n").encode())
            if not self.reinit_done.wait(REINIT_WAIT) or child.poll() is not None:
                self.last_error = "the new connector code didn't start (see the Claude app's MCP log)"
                _log(self.last_error)
                return False
            if done is not None:
                self._to_child(done)
        with self.lock:
            self.ready = True
            held, self.held = self.held, []
            # The first child gets Claude's handshake in the held lines; a later one already had it.
            for line in held:
                if init is not None and line in (init, done):
                    continue
                if not self._to_child(line):
                    self.held.append(line)
                    self.ready = False
        return True

    def fail_pending(self, why: str) -> None:
        """Requests a dead child was answering get an error, so Claude isn't left waiting."""
        with self.lock:
            ids, self.pending = list(self.pending.items()), {}
            held_ids = set()
            for line in self.held:
                try:
                    m = json.loads(line)
                    if isinstance(m, dict) and "id" in m and m.get("method"):
                        held_ids.add(json.dumps(m["id"]))
                except ValueError:
                    pass
            for key, method in ids:
                if key in held_ids:
                    self.pending[key] = method  # not sent yet: the next child answers it
                    continue
                self.send_out({"jsonrpc": "2.0", "id": json.loads(key), "error": {"code": -32603, "message": why}})

    def jobs_running(self) -> bool:
        try:
            return self.busy is not None and any(self.busy.iterdir())
        except OSError:
            return False

    def _clear_busy(self) -> None:
        """A job's mark outlives a child that was stopped; the next child starts with none."""
        try:
            for p in self.busy.iterdir() if self.busy is not None else ():
                p.unlink()
        except OSError:
            pass

    def restart(self, reason: str) -> None:
        _log("restarting the connector: %s" % reason)
        with self.lock:
            self.ready = False
            old = self.child
        if old is not None and old.poll() is None:
            try:
                old.terminate()
                old.wait(10)
            except Exception:
                try:
                    old.kill()
                except Exception:
                    pass
        self._clear_busy()
        self.fail_pending("The Vectorworks connector restarted while answering this (%s). Try again." % reason)
        if self.start_child():
            self.restarts += 1
            self.send_out({"jsonrpc": "2.0", "method": "notifications/tools/list_changed"})

    # ---- the loop ----------------------------------------------------------------------------

    def watch(self, stop: threading.Event, poll: float = POLL, settle: float = SETTLE) -> None:
        seen = snapshot(self.root)
        changed_at: Optional[float] = None
        while not stop.wait(poll):
            child = self.child
            if child is None or child.poll() is not None or not self.ready:
                if time.monotonic() - self.last_start >= RESPAWN_GAP:
                    self.restart("it wasn't running" if child is None else "it stopped" if child.poll() is not None else "it didn't start")
                    seen = snapshot(self.root)
                elif self.held and not self.ready:
                    self._answer_held_while_down()
                continue
            now = snapshot(self.root)
            if now != seen:
                seen, changed_at = now, time.monotonic()
            if changed_at is not None and time.monotonic() - changed_at >= settle:
                with self.lock:
                    busy = bool(self.pending) or self.jobs_running()
                if not busy:
                    changed_at = None
                    self.restart("its code changed")
                    seen = snapshot(self.root)

    def _answer_held_while_down(self) -> None:
        """While no child will start, requests are answered with why rather than left hanging."""
        why = self.last_error or "the connector is restarting"
        with self.lock:
            keep = []
            for line in self.held:
                try:
                    m = json.loads(line)
                except ValueError:
                    continue
                if isinstance(m, dict) and m.get("method") in ("initialize", "notifications/initialized"):
                    keep.append(line)
                    continue
                if isinstance(m, dict) and "id" in m and m.get("method"):
                    self.pending.pop(json.dumps(m["id"]), None)
                    self.send_out({"jsonrpc": "2.0", "id": m["id"], "error": {"code": -32603, "message": "The Vectorworks connector can't start: %s" % why}})
            self.held = keep

    def stop(self) -> None:
        self.closed = True
        c = self.child
        if c is not None and c.poll() is None:
            try:
                if c.stdin:
                    c.stdin.close()
                c.wait(5)
            except Exception:
                c.kill()


def run(cmd: list, root: Path, busy: Optional[Path] = None) -> int:
    """Serve Claude on this process's stdin/stdout through a supervised child running `cmd`."""
    stdout = sys.stdout.buffer

    def write(b: bytes) -> None:
        stdout.write(b)
        stdout.flush()

    sup = Supervisor(cmd, root, write, busy=busy)
    sup.start_child()
    stop = threading.Event()
    threading.Thread(target=sup.watch, args=(stop,), daemon=True).start()
    try:
        for line in iter(sys.stdin.buffer.readline, b""):
            if line.strip():
                sup.from_claude(line)
    finally:
        stop.set()
        sup.stop()
    return 0
