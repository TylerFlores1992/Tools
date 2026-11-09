"""Read a Vectorworks file out to a small JSON file beside it, so the drawing can be worked on with
Vectorworks closed (Rig Studio and Claude read it through Dropbox).

`<name>.rigread.json` holds the document's layers and classes, every plug-in object with all its
fields (lighting devices, truss, hoists, decks...), every symbol, and the shapes, in inches. It is
kept under Dropbox's 5 MB text limit by leaving out the plainest shapes first (it says how many).
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

SUFFIX = ".rigread.json"
LIMIT = 4_800_000  # bytes; Dropbox reads text files up to 5 MiB


def target_for(vwx: Path) -> Path:
    return vwx.with_name(vwx.stem + SUFFIX)


def fit(readout: dict, limit: int = LIMIT) -> tuple[bytes, int]:
    """The read-out as compact JSON under `limit` bytes. Plug-in objects and symbols always stay;
    plain shapes go first, the ones with the most points first, then the rest. Returns the bytes
    and how many shapes were left out."""
    def dump(r):
        return json.dumps(r, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    data = dump(readout)
    if len(data) <= limit:
        return data, 0
    objs = readout["objects"]
    keep = [o for o in objs if "plugin" in o or "symbol" in o]
    shapes = sorted((o for o in objs if not ("plugin" in o or "symbol" in o)), key=lambda o: len(o.get("pts", [])))
    lo, hi = 0, len(shapes)
    best = None
    while lo <= hi:  # the most shapes that still fit
        mid = (lo + hi) // 2
        trial = dict(readout, objects=keep + shapes[:mid], trimmed=len(shapes) - mid)
        b = dump(trial)
        if len(b) <= limit:
            best, lo = (b, len(shapes) - mid), mid + 1
        else:
            hi = mid - 1
    if best is None:
        raise ValueError("even the plug-in objects alone are over %d bytes" % limit)
    return best


def summary(readout: dict) -> dict:
    """Counts a person can read: plug-in types, lighting devices, symbols, shapes, layers."""
    plugins: dict[str, int] = {}
    symbols = shapes = 0
    for o in readout.get("objects", []):
        if "plugin" in o:
            plugins[o["plugin"] or "(unnamed)"] = plugins.get(o["plugin"] or "(unnamed)", 0) + 1
        elif "symbol" in o:
            symbols += 1
        else:
            shapes += 1
    return {
        "document": readout.get("document"),
        "objects": len(readout.get("objects", [])),
        "plugins": dict(sorted(plugins.items(), key=lambda kv: -kv[1])),
        "lighting_devices": plugins.get("Lighting Device", 0),
        "symbols": symbols,
        "shapes": shapes,
        "layers": len(readout.get("layers", [])),
        "truncated": bool(readout.get("truncated")),
    }


def same_document(open_name: str, path: Path) -> bool:
    """Whether the document open in Vectorworks is this file (by name; VW may add ' v2026')."""
    a = re.sub(r"\.vwx$", "", open_name, flags=re.I).strip().lower()
    b = path.stem.strip().lower()
    return a == b or a.startswith(b + " v20") or b.startswith(a)


def open_in_vectorworks(path: Path) -> None:
    """Ask Windows to open the file; Vectorworks takes it (a running copy opens it in a new window)."""
    if not hasattr(os, "startfile"):
        raise RuntimeError("opening files needs Windows")
    os.startfile(str(path))  # noqa: S606 - a file the user asked for, opened by its own app


def needs_read(vwx: Path) -> bool:
    t = target_for(vwx)
    return not t.exists() or t.stat().st_mtime < vwx.stat().st_mtime


def vwx_files(folder: Path) -> list[Path]:
    """The .vwx files in a folder and below, leaving out Vectorworks' backup folders."""
    return sorted(p for p in folder.rglob("*.vwx") if not any(part.lower() in ("vw backup", "backup") for part in p.parts) and "-backup-" not in p.name.lower())
