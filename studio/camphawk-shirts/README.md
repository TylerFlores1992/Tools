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

## Round 3 (2026-10-07): ten new giveaway ideas

The owner kept Still Water and turned down Night Watch. `round3.mjs` draws ten one-ink giveaway
mockups for free (code, the traced hawk, and the already-paid treeline and lake layers) into `out3/`.
Gallery: https://claude.ai/artifact/FUmtsCoWaENHSEuTgqPg4E

## Final (2026-10-07): Still Water, two ways

The owner picked round 3 idea 5: the one-ink Still Water becomes the giveaway (natural shirt, forest ink);
the three-ink Still Water stays for the owners. Night Watch is dropped (its kit files remain for reference).
Page: https://claude.ai/artifact/ATGRwtfvCjxre1HkovX4bC. One-ink pipeline: `node round2.mjs onelayers`
(base and hatch at 300 dpi) → `python3 cleanone.py` (drops hatch bits under 3 mm / 1 mm², fills knockouts
under 1 mm in the illustration only) → `node kitone.mjs` (vector per ink). Critic: 7/10 before those fixes.
Image credit used in total: $0.40 of the owner's $0.75.

## Tent mockup (2026-10-07, owner's ask)
A small A-frame tent on the left shore at the base of the mountain, mirrored in the lake like the rest
of the design, with a lit doorway (a knockout on the one-ink print, mist ink on the three-ink). Mockup
only: `python3 tent.py <kit 300 dpi png> <out> <ink hex> knockout|<door hex>` draws it onto the kit
render, then `composite.py` puts it on the shirt photos. The vector kit files are unchanged until the
owner picks it; then the tent goes into `round2.mjs` and the kits are rebuilt and print-checked.
