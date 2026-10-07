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

## Round 2 (2026-10-07): the two picks, refined for print

The owner picked concept 3 ("Night Watch", 1 ink on charcoal) and 7 ("Still Water", 3 inks on sage).
Review page: https://claude.ai/artifact/ATGRwtfvCjxre1HkovX4bC. Print files are in `kit/`: one SVG per
ink (sized in inches, text outlined), a combined SVG, and 300 dpi transparent PNGs for DTG.

- `ref/` holds the paid images (Recraft v4.1 at $0.035 each, Flux 1.1 at $0.04 each; $0.36 of the
  owner's $0.75 used): the lake diamond, the treeline, and two blank-shirt photos.
- `round2.mjs` builds both designs (`nightWatch3`, `stillWater4`, and their chest prints) on top of
  `lib.mjs` (the round-1 helpers). Modes: `all` (mockups), `print` (300 dpi renders), `alpha`
  (transparent renders for the photo composites).
- From `ref/` to traced layers (run from this folder, with `gen/` holding the source images):
  `python3 seprow.py gen/lakeflat-2-c.png gen/lf2` (snow and paper are the same white, so paper is
  everything outside each row's inked span), copy `gen/lf2-*.png` here, then
  `TURD=60 node trace.mjs lf2-dark lf2-mid lf2-light`. Treeline: threshold ×3, then `TURD=30 node trace.mjs trees1`.
- `printcheck.py <render> <shirt hex> <ink hex>…` separates a 300 dpi render into inks and flags
  knockouts under 1 mm and lines under 0.3 mm (it over-reports stroke tips and letter corners).
  `kit.mjs` traces those separations into the print files. `composite.py` puts a print onto a photo.
- `gen.mjs` calls AI Gateway directly and stops at a $1.30 balance (the owner's $0.75 limit).
