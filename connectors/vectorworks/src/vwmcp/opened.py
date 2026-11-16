"""The drawings the connector opened or saved itself, so it can close them before opening the next.

Vectorworks stops opening files at its open document limit (measured 2026-11-15: a worker's
read_out of a new file was refused with seven drawings open; four were earlier jobs'). Nothing
outside this list is ever closed: the designer's own drawings stay as they are.

Each row: {"name": "<file name>", "copy": true|false}. "copy" marks the unsaved copy Vectorworks
makes opening a file from an older version: only those are thrown away when closing (the file
itself is still on disk). Anything else is closed only if it has nothing unsaved. A name alone
can't tell a copy apart ("CFF-26_041426_v2025.vwx" is the designer's own file), so the flag is
set by whoever saw the file open.
"""

from __future__ import annotations

import json
from pathlib import Path

FILE = Path.home() / ".vwmcp" / "opened.json"
KEEP = 50  # rows, newest last


def rows() -> list[dict]:
    try:
        data = json.loads(FILE.read_text(encoding="utf-8"))
    except Exception:
        return []
    out = []
    for r in data if isinstance(data, list) else []:
        if isinstance(r, dict) and str(r.get("name") or "").strip():
            out.append({"name": str(r["name"]).strip(), "copy": bool(r.get("copy"))})
    return out


def _write(data: list[dict]) -> None:
    try:
        FILE.parent.mkdir(parents=True, exist_ok=True)
        FILE.write_text(json.dumps(data[-KEEP:], indent=1), encoding="utf-8")
    except Exception:
        pass


def _key(name: str) -> str:
    return Path(str(name).replace("\\", "/")).name.strip().lower()


def remember(name: str, copy: bool = False) -> None:
    n = Path(str(name).replace("\\", "/")).name.strip()
    if not n:
        return
    _write([r for r in rows() if _key(r["name"]) != _key(n)] + [{"name": n, "copy": bool(copy)}])


def forget(name: str) -> None:
    data = rows()
    left = [r for r in data if _key(r["name"]) != _key(name)]
    if len(left) != len(data):
        _write(left)


def to_close(open_tabs: list[str], keep: str | None = None) -> list[tuple[str, bool]]:
    """The open drawings to close before opening another, as (tab name, is a converted copy):
    only ones on the list, never `keep`."""
    mine = {_key(r["name"]): r["copy"] for r in rows()}
    k = _key(keep) if keep else None
    return [(t, mine[_key(t)]) for t in open_tabs if _key(t) in mine and _key(t) != k]
