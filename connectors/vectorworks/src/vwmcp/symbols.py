"""Which Vectorworks symbol each rig part is built from, as data.

The built-in copy is symbols.json next to this file. The site serves the current one at
/private/vectorworks/symbols.json (bearer VWMCP_RIG_TOKEN, like the designs); `refresh` fetches
it, keeps it in ~/.vwmcp/symbols.json and applies it, so a new truss size or symbol name needs no
connector update. A bad or unreachable copy never breaks a build: the last good one stays.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from . import rig

BUILTIN = Path(__file__).with_name("symbols.json")
STALE_SECONDS = 3600


class SymbolMapError(ValueError):
    pass


def validate(m: object) -> dict:
    """The map, or SymbolMapError saying what's wrong. Checked before anything is applied."""
    if not isinstance(m, dict) or m.get("version") != 1:
        raise SymbolMapError("not a version-1 symbol map")
    truss = m.get("truss")
    if not isinstance(truss, dict) or not truss:
        raise SymbolMapError("no truss series")
    for sid, t in truss.items():
        if not isinstance(t, dict) or not (isinstance(t.get("prefix"), str) or (isinstance(t.get("names"), list) and t["names"] and all(isinstance(n, str) for n in t["names"]))):
            raise SymbolMapError("truss %r needs a prefix or a list of names" % sid)
    lengths = m.get("trussLengthsFt")
    if not isinstance(lengths, list) or not lengths or not all(isinstance(x, (int, float)) and x > 0 for x in lengths):
        raise SymbolMapError("trussLengthsFt must be a list of positive numbers")
    clamps = m.get("clamps")
    if not isinstance(clamps, dict) or not all(str(k).lstrip("-").isdigit() and isinstance(v, str) for k, v in clamps.items()):
        raise SymbolMapError("clamps must map angles to names")
    deck = m.get("deck")
    if not isinstance(deck, dict) or not all(isinstance(deck.get(k), str) for k in ("symbol", "import", "leg")):
        raise SymbolMapError("deck needs symbol, import and leg names")
    if "{w}" not in deck["symbol"] or "{l}" not in deck["symbol"] or "{h}" not in deck["leg"]:
        raise SymbolMapError("deck names need {w}, {l} and {h}")
    if not isinstance(deck.get("legHeights"), list) or not all(isinstance(x, (int, float)) for x in deck["legHeights"]):
        raise SymbolMapError("deck legHeights must be numbers")
    if not isinstance(m.get("notInLibrary", {}), dict):
        raise SymbolMapError("notInLibrary must map part kinds to a reason")
    return m


def apply(m: dict) -> None:
    """Point the build code at this map's names."""
    validate(m)
    rig.SERIES_SYMBOL_PREFIX.clear()
    rig.FILE_ONLY_SERIES.clear()
    for sid, t in m["truss"].items():
        if t.get("names"):
            rig.FILE_ONLY_SERIES[sid] = list(t["names"])
        else:
            rig.SERIES_SYMBOL_PREFIX[sid] = t["prefix"]
    rig.TRUSS_SYMBOL_LENGTHS_FT = tuple(int(x) if float(x).is_integer() else x for x in m["trussLengthsFt"])
    rig.CLAMP_SYMBOLS.clear()
    rig.CLAMP_SYMBOLS.update({int(k): v for k, v in m["clamps"].items()})
    rig.DECK_SYMBOL = m["deck"]["symbol"]
    rig.DECK_IMPORT = m["deck"]["import"]
    rig.LEG_SYMBOL = m["deck"]["leg"]
    rig.DECK_LEG_HEIGHTS = tuple(m["deck"]["legHeights"])
    rig.NOT_IN_LIBRARY.clear()
    rig.NOT_IN_LIBRARY.update(m.get("notInLibrary", {}))
    global CURRENT
    CURRENT = m


def builtin() -> dict:
    return validate(json.loads(BUILTIN.read_text(encoding="utf-8")))


CURRENT: dict = {}


def load_cached(home: Path) -> str:
    """Apply the copy last fetched from the site if it's good, else the built-in one. Says which."""
    cache = home / "symbols.json"
    try:
        apply(json.loads(cache.read_text(encoding="utf-8")))
        return "site copy from %s" % time.strftime("%Y-%m-%d %H:%M", time.localtime(cache.stat().st_mtime))
    except (OSError, ValueError):
        apply(builtin())
        return "built-in"


def url(base: str) -> str:
    return base.rstrip("/") + "/private/vectorworks/symbols.json"


def refresh(base: str, token: str, home: Path, timeout: float = 8.0, force: bool = False) -> str:
    """Fetch the site's map (at most hourly unless forced), keep it and apply it. Returns a short
    status. Never raises for network or content problems: the current map stays in force."""
    cache = home / "symbols.json"
    if not token:
        return "no site key (VWMCP_RIG_TOKEN), using %s" % ("the last site copy" if cache.exists() else "the built-in map")
    if not force and cache.exists() and time.time() - cache.stat().st_mtime < STALE_SECONDS:
        return "site copy is fresh"
    req = urllib.request.Request(url(base), headers={"Authorization": "Bearer %s" % token, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            m = validate(json.loads(r.read().decode("utf-8")))
    except (urllib.error.URLError, OSError, ValueError) as e:
        return "couldn't refresh the symbol map (%s); kept the current one" % (getattr(e, "reason", None) or e)
    apply(m)
    home.mkdir(parents=True, exist_ok=True)
    tmp = cache.with_suffix(".tmp")
    tmp.write_text(json.dumps(m, indent=1), encoding="utf-8")
    tmp.replace(cache)
    return "refreshed from the site"
