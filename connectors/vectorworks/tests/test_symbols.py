"""Symbol names as data: the built-in map, one fetched from the site, and bad maps refused."""

import io
import json
import os
import time

import pytest

from vwmcp import rig, symbols


@pytest.fixture(autouse=True)
def builtin_after():
    yield
    symbols.apply(symbols.builtin())


def test_the_built_in_map_gives_the_names_the_build_has_always_used():
    symbols.apply(symbols.builtin())
    assert rig.truss_symbol_candidates("box12")[0] == "Truss Box 12in x 12in x 10ft"
    assert rig.truss_symbol_candidates("box20")[0] == "Truss 20.5\" Box 10' (SLV)"
    assert rig.deck_symbol(48, 96) == "Stage Deck 4ft x 8ft"
    assert rig.deck_import_name(48, 96) == "Stage Deck 4ft x 8ft x 2ft"
    assert rig.leg_symbol(24) == "Stage Deck Leg 24in"
    assert rig.CLAMP_SYMBOLS[45] == "Aluminium Scaffold Clamp-45 Deg"


def test_a_new_series_or_name_from_the_site_needs_no_code():
    m = symbols.builtin()
    m["truss"]["box16"] = {"prefix": "Truss Box 16in x 16in"}
    m["deck"]["leg"] = "Riser Leg {h}in"
    m["deck"]["legHeights"] = [6, 30]
    symbols.apply(m)
    assert rig.truss_symbol_candidates("box16")[0] == "Truss Box 16in x 16in x 10ft"
    assert rig.leg_symbol(30) == "Riser Leg 30in"
    with pytest.raises(rig.RigError, match='legs come in 6", 30"'):
        rig.leg_symbol(24)


@pytest.mark.parametrize(
    "broken",
    [
        lambda m: m.update(version=2),
        lambda m: m["truss"].update(box12={}),
        lambda m: m.update(trussLengthsFt=[]),
        lambda m: m["deck"].update(symbol="Stage Deck"),
        lambda m: m["clamps"].update(x="y"),
    ],
)
def test_a_bad_map_is_refused_whole(broken):
    m = symbols.builtin()
    broken(m)
    with pytest.raises(symbols.SymbolMapError):
        symbols.apply(m)
    assert rig.deck_symbol(48, 48) == "Stage Deck 4ft x 4ft"


class Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_refresh_keeps_a_good_copy_and_ignores_a_bad_one(tmp_path, monkeypatch):
    good = symbols.builtin()
    good["truss"]["box16"] = {"prefix": "Truss Box 16in x 16in"}
    monkeypatch.setattr(symbols.urllib.request, "urlopen", lambda req, timeout: Resp(json.dumps(good).encode()))
    assert symbols.refresh("https://x", "k", tmp_path) == "refreshed from the site"
    assert "box16" in rig.SERIES_SYMBOL_PREFIX
    assert symbols.refresh("https://x", "k", tmp_path) == "site copy is fresh"

    monkeypatch.setattr(symbols.urllib.request, "urlopen", lambda req, timeout: Resp(b'{"version": 7}'))
    assert symbols.refresh("https://x", "k", tmp_path, force=True).startswith("couldn't refresh")
    assert "box16" in rig.SERIES_SYMBOL_PREFIX  # the good map stays in force

    symbols.apply(symbols.builtin())
    assert symbols.load_cached(tmp_path).startswith("site copy")
    assert "box16" in rig.SERIES_SYMBOL_PREFIX
    (tmp_path / "symbols.json").write_text("not json")
    assert symbols.load_cached(tmp_path) == "built-in"
    assert symbols.refresh("https://x", "", tmp_path).startswith("no site key")
