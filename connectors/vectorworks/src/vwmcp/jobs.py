"""File-based job queue shared by the MCP server and the bridge running inside Vectorworks.

    server writes   <home>/jobs/<id>.json        {"id", "op", "args", "created"}
    bridge renames  <home>/jobs/<id>.running     (so the server knows it was picked up)
    bridge writes   <home>/results/<id>.json     {"id", "ok", "result" | "error", "traceback"}

Every write goes to a temp file first and is then renamed, so neither side ever reads
a half-written file.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

from .config import Settings
from .trigger import Trigger


class BridgeError(RuntimeError):
    """Vectorworks ran the job and reported an error."""


class BridgeTimeout(RuntimeError):
    """Vectorworks never answered."""


def write_json_atomic(path: Path, data: dict[str, Any]) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    os.replace(tmp, path)


# Under the connector's home: one file per job running (see supervisor.py).
BUSY_DIR = "busy"


class JobQueue:
    def __init__(self, settings: Settings, trigger: Trigger, poll_interval: float = 0.05):
        self.settings = settings
        self.trigger = trigger
        self.poll_interval = poll_interval
        settings.jobs_dir.mkdir(parents=True, exist_ok=True)
        settings.results_dir.mkdir(parents=True, exist_ok=True)

    async def call(self, op: str, _timeout: float | None = None, **args: Any) -> Any:
        """Run one op. `_timeout` overrides the settings' timeout for a long job (a whole rig)."""
        timeout = float(_timeout) if _timeout else self.settings.timeout
        job_id = uuid.uuid4().hex
        job_path = self.settings.jobs_dir / f"{job_id}.json"
        result_path = self.settings.results_dir / f"{job_id}.json"
        created = time.time()
        # Marked busy while it runs, so the supervisor never swaps the connector's code mid-job
        # (a Rig Studio read-out runs in the background, not as one of Claude's requests).
        busy = self.settings.home / BUSY_DIR / job_id
        with contextlib.suppress(OSError):
            busy.parent.mkdir(parents=True, exist_ok=True)
            busy.write_text(op, encoding="utf-8")
        try:
            return await self._run(op, job_id, job_path, result_path, created, timeout, args)
        finally:
            with contextlib.suppress(OSError):
                busy.unlink()

    async def _run(self, op: str, job_id: str, job_path: Path, result_path: Path, created: float, timeout: float, args: dict) -> Any:
        # ttl: the bridge drops a job that waited longer than the server was willing to wait.
        write_json_atomic(job_path, {"id": job_id, "op": op, "args": args, "created": created, "ttl": timeout + 5})

        await asyncio.to_thread(self.trigger.fire, created)
        deadline = time.monotonic() + timeout
        last_fire = time.monotonic()
        refire_error: Exception | None = None

        try:
            while time.monotonic() < deadline:
                if result_path.exists():
                    data = json.loads(result_path.read_text(encoding="utf-8"))
                    result_path.unlink(missing_ok=True)
                    # The press leaves Vectorworks' Tools menu hanging open; close it so the
                    # designer's next click doesn't just close a menu (seen after every read-out).
                    with contextlib.suppress(Exception):
                        await asyncio.to_thread(getattr(self.trigger, "tidy", lambda: None))
                    if data.get("ok"):
                        return data.get("result")
                    msg = data.get("error", "unknown error")
                    if data.get("traceback"):
                        msg += "\n\n" + data["traceback"]
                    raise BridgeError(msg)

                # Hotkey got lost (Vectorworks busy, a dialog open, focus fight): press it again.
                # A press that fails here doesn't end the job: the first press usually got through and
                # Vectorworks is just busy starting it (a big read-out keeps it "Not Responding" for a
                # while, and then no window can be found). Measured 2026-11-10: the re-press raised
                # "No Vectorworks window found", the job was dropped, and Vectorworks finished it anyway.
                if job_path.exists() and time.monotonic() - last_fire > self.settings.refire_after:
                    try:
                        await asyncio.to_thread(self.trigger.fire)  # no job time: always press
                        refire_error = None
                    except Exception as e:
                        refire_error = e
                    last_fire = time.monotonic()

                await asyncio.sleep(self.poll_interval)
        except BaseException:
            job_path.unlink(missing_ok=True)
            raise

        picked_up = not job_path.exists()
        job_path.unlink(missing_ok=True)  # don't let a stale job run later by surprise
        if picked_up:
            raise BridgeTimeout(
                f"Vectorworks started '{op}' but didn't finish within {timeout:.0f}s."
            )
        if refire_error is not None:
            raise BridgeTimeout(f"Vectorworks never picked up '{op}': {refire_error}")
        raise BridgeTimeout(
            f"Vectorworks never picked up '{op}'. Check that it's open, no dialog is showing, "
            f"and the 'MCP Run Job' shortcut matches VWMCP_HOTKEY ({self.settings.hotkey})."
        )
