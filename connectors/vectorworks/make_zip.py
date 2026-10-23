"""Build the connector download offered on /private/vectorworks.

    python connectors/vectorworks/make_zip.py

Writes public/private/vectorworks/vwmcp-win.zip (served only behind the Private sign-in), with
the shared length cases copied into tests/fixtures so the zip's tests run on their own.
Deterministic: same files in, same bytes out.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = REPO / "public" / "private" / "vectorworks" / "vwmcp-win.zip"
SKIP_DIRS = {"__pycache__", ".pytest_cache", ".venv", "build", "dist"}
STAMP = (2026, 1, 1, 0, 0, 0)


def files():
    for p in sorted(HERE.rglob("*")):
        rel = p.relative_to(HERE)
        if p.is_file() and not (set(rel.parts) & SKIP_DIRS) and not rel.name.endswith(".egg-info") and p.name != "make_zip.py":
            yield rel, p.read_bytes()
    yield Path("tests/fixtures/length-cases.json"), (REPO / "src/tools/vectorworks/length-cases.json").read_bytes()


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for rel, data in files():
            info = zipfile.ZipInfo(f"vwmcp-win/{rel.as_posix()}", STAMP)
            info.external_attr = 0o644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    print(f"wrote {OUT.relative_to(REPO)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
