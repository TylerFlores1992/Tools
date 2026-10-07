# CampHawk shirt concepts (round 1, free)

Ten t-shirt mockups for CampHawk, made without paid image credit. The hawk and the badge are traced
from the real logo (`../camphawk-round2/ref/logo-badge-original.png`) into one-ink layers. Fonts are
OFL, from Fontsource. Shirts and print placement are drawn in SVG and rendered with Chromium.

Run from this folder:

    npm i potrace playwright-core           # once (not committed)
    python3 layers.py ../camphawk-round2/ref/logo-badge-original.png   # → hawk-*.png, badge-*.png
    node trace.mjs hawk-sil hawk-eng badge-dark badge-mid             # → traced-*.svg
    ./fonts.sh                                                        # → fonts/, fonts.css
    node build.mjs                                                    # → out/concept-NN.png

Generated files are gitignored. Concept list, inks and notes: the `designs` array in `build.mjs`.
Next step (owner picks two): finals through Recraft vector ($0.08 each) within the owner's $0.75.
