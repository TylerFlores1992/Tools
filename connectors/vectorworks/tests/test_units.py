"""The bridge reads lengths exactly like the panel on tylerflores.dev does.

Both read the same cases: src/tools/vectorworks/length-cases.json in this repo (the zip carries
a copy in tests/fixtures/, written by make_zip.py).
"""

import json
from pathlib import Path

import pytest

import vwmcp_bridge as bridge

_HERE = Path(__file__).resolve().parent
_SHARED = _HERE.parent.parent.parent / "src" / "tools" / "vectorworks" / "length-cases.json"
CASES = json.loads((_SHARED if _SHARED.exists() else _HERE / "fixtures" / "length-cases.json").read_text())
UPI = {"in": 1.0, "mm": 25.4}


@pytest.mark.parametrize("case", CASES, ids=[c["input"] or "(empty)" for c in CASES])
def test_shared_length_cases(case):
    got = bridge.parse_length(case["input"], UPI[case["units"]])
    if case["expect"] is None:
        assert got is None
    else:
        assert got == pytest.approx(case["expect"])


def test_numbers_pass_through_and_bools_dont():
    assert bridge.parse_length(42, 1.0) == 42.0
    assert bridge.parse_length(2.5, 25.4) == 2.5
    assert bridge.parse_length(True, 1.0) is None


def test_curly_quotes_from_phones():
    assert bridge.parse_length("12’-6”", 1.0) == 150
