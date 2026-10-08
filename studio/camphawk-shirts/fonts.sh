#!/usr/bin/env bash
# Fetches the OFL display fonts the concepts use from Fontsource (not committed), then inlines them.
set -euo pipefail
mkdir -p fonts
for f in josefin-sans:600 josefin-sans:400 alfa-slab-one:400 bebas-neue:400 yellowtail:400 rye:400 oswald:700 oswald:500 zilla-slab:700 josefin-sans:700 arvo:700 fraunces:900 ultra:400 big-shoulders-display:800 big-shoulders-display:900 dm-serif-display:400 sancreek:400 kaushan-script:400 roboto-slab:800 barlow-condensed:700 barlow-condensed:500; do
  n=${f%:*}; w=${f#*:}
  curl -sf "https://cdn.jsdelivr.net/npm/@fontsource/$n/files/$n-latin-$w-normal.woff2" -o "fonts/$n-$w.woff2"
done
python3 fonts.py
