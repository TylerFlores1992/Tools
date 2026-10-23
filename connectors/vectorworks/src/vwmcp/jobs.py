"""File-based job queue shared by the MCP server and the bridge running inside Vectorworks.

    server writes   <home>/jobs/<id>.json        {"id", "op", "args", "created"}
    bridge renames  <home>/jobs/<id>.running     (so the server knows it was picked up)
    bridge writes   <home>/results/<id>.json     {"id", "ok", "result" | "error", "traceback"}

Every write goes to a temp file first and is then renamed, so neither side ever reads
a half-written file.
"""

from __future__ import annotations

import asyncio
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


class JobQueue:
    def __init__(self, settings: Settings, trigger: Trigger, poll_interval: float = 0.05):
        self.settings = settings
        self.trigger = trigger
        self.poll_interval = poll_interval
        settings.jobs_dir.mkdir(parents=True, exist_ok=True)
        settings.results_dir.mkdir(parents=True, exist_ok=True)

    async def call(self, op: str, **args: Any) -> Any:
        job_id = uuid.uuid4().hex
        job_path = self.settings.jobs_dir / f"{job_id}.json"
        result_path = self.settings.results_dir / f"{job_id}.json"
        created = time.time()
        # ttl: the bridge drops a job that waited longer than the server was willing to wait.
        write_json_atomic(job_path, {"id": job_id, "op": op, "args": args, "created": created, "ttl": self.settings.timeout + 5})

        await asyncio.to_thread(self.trigger.fire, created)
        deadline = time.monotonic() + self.settings.timeout
        last_fire = time.monotonic()

        try:
            while time.monotonic() < deadline:
                if result_path.exists():
                    data = json.loads(result_path.read_text(encoding="utf-8"))
                    result_path.unlink(missing_ok=True)
                    if data.get("ok"):
                        return data.get("result")
                    msg = data.get("error", "unknown error")
                    if data.get("traceback"):
                        msg += "\n\n" + data["traceback"]
                    raise BridgeError(msg)

                # Hotkey got lost (Vectorworks busy, a dialog open, focus fight): press it again.
                if job_path.exists() and time.monotonic() - last_fire > self.settings.refire_after:
                    await asyncio.to_thread(self.trigger.fire)  # no job time: always press
                    last_fire = time.monotonic()

                await asyncio.sleep(self.poll_interval)
        except BaseException:
            job_path.unlink(missing_ok=True)
            raise

        picked_up = not job_path.exists()
        job_path.unlink(missing_ok=True)  # don't let a stale job run later by surprise
        if picked_up:
            raise BridgeTimeout(
                f"Vectorworks started '{op}' but didn't finish within {self.settings.timeout:.0f}s."
            )
        raise BridgeTimeout(
            f"Vectorworks never picked up '{op}'. Check that it's open, no dialog is showing, "
            f"and the 'MCP Run Job' shortcut matches VWMCP_HOTKEY ({self.settings.hotkey})."
        )
