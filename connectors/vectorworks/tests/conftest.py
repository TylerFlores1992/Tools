import os
import shutil
import sys
import tempfile
from pathlib import Path

# Must happen before the bridge is imported: it reads VWMCP_HOME at import time.
_HOME = Path(tempfile.mkdtemp(prefix="vwmcp-test-"))
os.environ["VWMCP_HOME"] = str(_HOME)
os.environ["VWMCP_TRIGGER"] = "none"
os.environ["VWMCP_TIMEOUT"] = "5"

ROOT = Path(__file__).resolve().parent.parent
for p in ("src", "vw_plugin", "dev"):
    sys.path.insert(0, str(ROOT / p))

import pytest  # noqa: E402

import fake_vectorworks  # noqa: E402  (installs the strict fake vs, imports the bridge)


@pytest.fixture
def home():
    return _HOME


@pytest.fixture(autouse=True)
def clean_home():
    for sub in ("jobs", "results"):
        shutil.rmtree(_HOME / sub, ignore_errors=True)
    for f in ("journal.jsonl", "allow_exec", "stop"):
        (_HOME / f).unlink(missing_ok=True)
    shutil.rmtree(_HOME / "shows", ignore_errors=True)
    yield


@pytest.fixture
def fake_vw():
    stop = fake_vectorworks.start_in_thread(demo=True)
    yield fake_vectorworks.fake_vs
    stop.set()


@pytest.fixture
def fake_show():
    stop = fake_vectorworks.start_in_thread(show=True)
    yield fake_vectorworks.fake_vs
    stop.set()
