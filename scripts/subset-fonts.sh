#!/usr/bin/env bash
# Rebuild the subset fonts in src/fonts/ from the full fontsource variable files.
# Needs: pip install fonttools brotli. Usage: scripts/subset-fonts.sh <mona-src.woff2> <jetbrains-src.woff2>
# Sources: @fontsource-variable/mona-sans (mona-sans-latin-standard-normal.woff2) and
#          @fontsource-variable/jetbrains-mono (jetbrains-mono-latin-wght-normal.woff2).
# If you add a glyph to the UI (a new symbol) or a new weight/width, widen the lists below.
set -euo pipefail
MONA_SRC="$1"; JB_SRC="$2"; OUT="$(dirname "$0")/../src/fonts"; TMP="$(mktemp -d)"
U="U+0020-007E,U+00A0,U+00A9,U+00B0,U+00B2,U+00B7,U+00D7,U+00F7,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2032-2033,U+2190-2199,U+221A,U+2212,U+25CC,U+25CF,U+2713,U+2715"
pyftsubset "$MONA_SRC" --unicodes="$U" --layout-features='kern,liga,calt,tnum,case,ss01' --output-file="$TMP/mona.ttf"
pyftsubset "$JB_SRC" --unicodes="$U" --layout-features='kern,tnum' --output-file="$TMP/jb.ttf"
fonttools varLib.instancer "$TMP/mona.ttf" wdth=100:104 wght=400:600 -o "$TMP/mona-i.ttf" -q
fonttools varLib.instancer "$TMP/jb.ttf" wght=400:600 -o "$TMP/jb-i.ttf" -q
python3 - "$TMP" "$OUT" <<'PY'
import sys
from fontTools.ttLib import TTFont
tmp, out = sys.argv[1], sys.argv[2]
for src, dst in [("mona-i.ttf", "MonaSans-Variable.woff2"), ("jb-i.ttf", "JetBrainsMono-Variable.woff2")]:
    f = TTFont(f"{tmp}/{src}"); f.flavor = "woff2"; f.save(f"{out}/{dst}")
PY
ls -la "$OUT"/*.woff2
