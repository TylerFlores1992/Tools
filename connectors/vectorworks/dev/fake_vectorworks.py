"""Pretend to be Vectorworks: watch the job queue and answer with the fake `vs`.

    python dev/fake_vectorworks.py            # empty drawing
    python dev/fake_vectorworks.py --demo     # truss + four lighting devices

Run the real MCP server alongside it with VWMCP_TRIGGER=none and every tool works
end to end, on any OS, with no Vectorworks installed.
"""

from __future__ import annotations

import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "vw_plugin"))

import fake_vs  # noqa: E402

sys.modules["vs"] = fake_vs
import vwmcp_bridge  # noqa: E402


def serve(stop: threading.Event | None = None, poll: float = 0.02) -> None:
    while not (stop and stop.is_set()):
        vwmcp_bridge.run_pending()
        time.sleep(poll)


def start_in_thread(demo: bool = False) -> threading.Event:
    fake_vs.reset()
    if demo:
        fake_vs.seed_demo()
    stop = threading.Event()
    threading.Thread(target=serve, args=(stop,), daemon=True).start()
    return stop


if __name__ == "__main__":
    fake_vs.reset()
    if "--demo" in sys.argv:
        fake_vs.seed_demo()
    print(f"Fake Vectorworks watching {vwmcp_bridge.JOBS} (Ctrl+C to stop)")
    try:
        serve()
    except KeyboardInterrupt:
        pass
