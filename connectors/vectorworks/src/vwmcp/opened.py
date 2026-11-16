"""The drawings the connector opened or saved itself, so it can close them before opening the next.

Vectorworks stops opening files at its open document limit (measured 2026-11-15: a worker's
read_out of a new file was refused with seven drawings open; four were earlier jobs'). Nothing
outside this list is ever closed: the designer's own drawings stay as they are.

Each row: {"name": "<file name>", "kind": "copy" | "saved" | "opened"}. What "save changes?"
gets when the connector closes it:
- "copy": the unsaved copy Vectorworks makes opening a file from an older version. No: the file
  itself is still on disk, and anything kept went out through save_as.
- "saved": a new file a job made with save_as (never the designer's original). Yes: a job keeps
  working after saving (Export PDF, viewports to the front), and Vectorworks counts even that as
  a change (measured 2026-11-16: all three earlier jobs' files asked), so saving loses nothing.
- "opened": a file read_out opened as it is, which may be the designer's own. Cancel: it stays
  open with its changes.
A name alone can't tell these apart ("CFF-26_041426_v2025.vwx" is the designer's own file), so
the kind is set by whoever saw the file open or saved it.
"""

from __future__ import annotations

import json
from pathlib import Path

FILE = Path.home() / ".vwmcp" / "opened.json"
KEEP = 50  # rows, newest last
KINDS = ("copy", "saved", "opened")
ANSWERS = {"copy": ("No", "Don't Save", "Do not save"), "saved": ("Yes", "Save"), "opened": ("Cancel",)}


def rows() -> list[dict]:
    try:
        data = json.loads(FILE.read_text(encoding="utf-8"))
    except Exception:
        return []
    out = []
    for r in data if isinstance(data, list) else []:
        if isinstance(r, dict) and str(r.get("name") or "").strip():
            kind = r.get("kind")
            if kind not in KINDS:  # an older row: {"copy": true|false}
                kind = "copy" if r.get("copy") else "opened"
            out.append({"name": str(r["name"]).strip(), "kind": kind})
    return out


def _write(data: list[dict]) -> None:
    try:
        FILE.parent.mkdir(parents=True, exist_ok=True)
        FILE.write_text(json.dumps(data[-KEEP:], indent=1), encoding="utf-8")
    except Exception:
        pass


def _key(name: str) -> str:
    return Path(str(name).replace("\\", "/")).name.strip().lower()


def remember(name: str, kind: str = "opened") -> None:
    n = Path(str(name).replace("\\", "/")).name.strip()
    if not n:
        return
    if kind not in KINDS:
        raise ValueError("kind must be one of %s" % (KINDS,))
    _write([r for r in rows() if _key(r["name"]) != _key(n)] + [{"name": n, "kind": kind}])


def forget(name: str) -> None:
    data = rows()
    left = [r for r in data if _key(r["name"]) != _key(name)]
    if len(left) != len(data):
        _write(left)


def to_close(open_tabs: list[str], keep: str | None = None) -> list[tuple[str, str]]:
    """The open drawings to close before opening another, as (tab name, kind): only ones on the
    list, never `keep`."""
    mine = {_key(r["name"]): r["kind"] for r in rows()}
    k = _key(keep) if keep else None
    return [(t, mine[_key(t)]) for t in open_tabs if _key(t) in mine and _key(t) != k]
