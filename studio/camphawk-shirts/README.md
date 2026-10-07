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

## The camp (2026-10-07, owner's ask): tent and campfire in the print files
Both Still Water back prints now have a camp on the far shore under the peak. The fire burns just left
of the peak's axis and the tent stands just right of it, with its doorway facing the fire. Both are
mirrored in the lake as a few broken strokes, with two glints under the fire.

- **Tent:** Recraft v4.1 linocut (`ref/recraft-camp.png`, picked from four tries at $0.035 each), 1.2 in
  wide. Its walls flare into the shore, it has pole tips at the ridge ends, and one blunt lit doorway.
- **Fire:** drawn in `camp.py`, because Recraft's own fire turned to mush at an inch wide. It is one
  flame with a side lick and a 2.3 mm heart, over square-cut crossed logs, with hand-cut edges.
- **Knockouts:** the doorway and the fire's heart show the natural shirt (one ink) or mist ink (three).

Rebuild: `python3 camp.py [tent in] [axis x] [fire scale]` reads the camp-free renders
(`ref/still-water*_base_300dpi.png`) and writes `out2/camp-*`. Then `node campkit.mjs` traces each ink
into `kit/`. On print size:
- every knockout under 1.1 mm is closed in the file;
- the camp keeps at least 3.4 mm from the mountain;
- `printcheck.py` flags only tips and corners.

Critic: 6/10 on the first pass; 8/10 after redrawing the fire, calming the reflection and centering on
the peak. The last round's fixes (hand-cut fire edges, flared tent base, cleaner strokes) are in.
`gen.mjs` needs `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` in this container.
Image credit used in total: $0.54 of the owner's $0.75.

## Chest fix (2026-10-07)
The chest wordmark on both Still Water shirts ran past its 3.75 in canvas, so the print files had lost the
C and the K. It is now set to an exact width (`textLength`, 540 of 600 units, about 5 mm clear each side).
`node chest.mjs` rebuilds both chest prints on their own (it needs the hawk traces and fonts from the
round-1 steps above). Print check: letter corners and the hawk's narrowest feather slits are flagged,
as before; the slits close a little on press, and the hawk still reads.

## Printers (researched 2026-10-07)
Prices are per shirt, size M, from each printer's own quote tool. Giveaway = 1 back ink + 1 chest ink;
owners = 3 + 1. The kit page (https://claude.ai/artifact/W4NqM9AcXuW41qFYoVUGhM) has the full table
and the order spec.

| Printer | Giveaway at 24 / 50 / 100 / 250 | Owners at 24 | Notes |
|---|---|---|---|
| Threadbird | $25.51 / 16.66 / 13.56 / 12.36 | 36 minimum ($23.66) | Best value at 100 and best quality; shipping extra |
| Ooshirts | $19.51 / 17.48 / 16.27 / 15.58 | $21.78 | All-in, free setup and shipping; best for owners at 24 |
| RushOrderTees | $21.28 / 18.82 / 16.33 / 14.91 | $25.27 | All-in |
| Custom Ink | about $14–17 (est.) | — | Add $2–4 for the back (est.) |
| Real Thread | $11–15 (est.) | — | Water-based, soft print; quote by hand |

Skip DTG (Printful, Printify): it softens the hatching, and mist on sage needs a stiff white base.
Blanks: Comfort Colors 1717 in Ivory and in Sage, or Bella+Canvas 3001 Natural, about $1.70 less at
Threadbird.
Before ordering:
- ask for a strike-off;
- ask for a fine mesh screen for the hatching;
- ask whether mist needs a white underbase on sage.

## About $10 a shirt at about 20 (researched 2026-10-07)
The screen-print quotes above were too high for about 20 shirts. Routes that reach about $10, per shirt
at 20, with sources in the session's research:

| Route | Per shirt | Trade-off |
|---|---|---|
| **DTF gang sheet pressed at home** (chosen direction) | $8.30–9 | Someone presses each shirt; the 1 mm gaps are at DTF's limit |
| Ooshirts screen print, Gildan 5000 Natural, back only, 24 min | $9–11 (est.) | No chest print; a lighter blank |
| Printify DTG, Gildan 64000, back only | $10.50–11 (est.) | Softer lines; the green varies |
| Local screen printer, 24 | $12–14 (est.) | Price |
| AliExpress / Alibaba | $7–12, or $18–33 (est.) | About 36% duty since 2025, colour and line risk; skip |

DTF details:
- **Sheet:** one 22 in wide gang sheet. Backs turned sideways (13 × 11.5 in), about 240 in for 20,
  with the chests in the 9 in strip beside them.
- **Price:** DTF Transfers Now about $93 (free shipping over $75), or DTF Dallas $97.50.
- **Blanks:** Gildan 5000 Natural, $3.41 (S–XL) at Blankstyle.
- **Pressing:** use a heat press, not a household iron.
  - A 15 × 15 press does each back in one press; a 10 × 12 Cricut EasyPress needs two.
  - Cricut-cut vinyl can't hold the hatching, and sublimation needs polyester.
- **Files:** the transfers print from `kit/*_300dpi.png`.
- **Still to build:** the gang-sheet layout, once the owner gives the shirt counts and the press size.

