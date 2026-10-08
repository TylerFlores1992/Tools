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


## Round 4 (2026-10-07): Still Water without the diamond
The owner's wife: the peak mirrored in the lake makes the whole back print read as a diamond. Round 4 keeps
the approved peak, camp and hawk and changes only what sits below the shore. Seven layouts, all free:
Arch window, Panorama, Round badge (the reviewer's top three: 8, 7.5, 7), then Lake plate, Shoreline, Waterline
banner, Short reflection. Review page: https://claude.ai/artifact/SjC3vk4yMahmUMpr9DZt7j

- `python3 prep4.py` cuts both camp renders (`kit/*_back_300dpi.png`) at the shore, drops the hawk and writes
  the silhouette masks to `out4/`.
- `node round4.mjs [id]` draws each layout (one ink on natural, three inks on sage, a drawn tee, and a
  transparent render) into `out4/`. `python3 composite.py ref/flux-blank-natural.jpg out4/<id>-alpha.png
  out4/<id>-photo.jpg 520 290 330` puts one on the shirt photo. `sheet4.py` makes contact sheets.
- Water is drawn, never mirrored: tapering dashes in rows that thin out and spread apart, a column of light
  under the fire and the tent door, and every field square-edged so the outline can't point downward.
- Research behind the layouts: frames that cut the water off (arch, circle with a low horizon, panorama),
  a banner on the waterline, or water as broken dashes stopping at about a third of the peak's height.
- Mockups use the 300 dpi raster peak. The pick still needs: vector print files (trace as `campkit.mjs`
  does), `printcheck.py` at 300 dpi, then the Vercel image polish the owner planned.
- Reviewer notes not taken: "hatch gaps under 1 mm" (it measured downscaled previews; the print files
  were cleaned to 1 mm and over), "scale the tent and fire 1.4×" (the owner approved their size).
- `sheet4-share.mjs` makes the one numbered image of all seven for sharing (`round4-options.jpg`; needs `out4/old-diamond.png`, the old back on natural).

## The pick (2026-10-08): no. 7, Short reflection
The owner picked round 4's no. 7, "Short reflection" (`round4.mjs` id `dashes`). It is now the back print for
both shirts: the peak, camp and hawk stand on five rows of broken lake lines, then the wordmark. The print is
11.5 x 8.33 in (it was 11.5 x 13 in as the diamond). The chest prints are unchanged.
- `python3 prep4.py` (the peak without its reflection, from the old diamond renders kept in
  `ref/still-water*_diamond_300dpi.png`), then `node final4.mjs`. It renders at 300 dpi, snaps every pixel to
  an ink, and traces one SVG per ink into `kit/`, plus the 300 dpi PNGs.
- Print check: only the pointed tips of the lake dashes and letter and tree corners are flagged; every gap
  between dashes is well over 1 mm. The peak and camp are the art that passed before.
- `campkit.mjs` (the diamond kit) now writes to `out2/kit-diamond/`, so it can never overwrite the kit.
- Kit page (mockups, a zip of all 12 files, order spec, the DTF plan): https://claude.ai/artifact/W4NqM9AcXuW41qFYoVUGhM
- Still open: the Vercel image polish the owner planned, and the DTF gang sheet once the shirt counts and the
  heat press size are known (the shorter back fits more to a 22 in sheet).


## Round 5 (2026-10-08): the pick, polished to the reviewers' notes
Baseline scores for the pick: 6/10 from an apparel art director, 6/10 from a print technician. Round 5:
- `polish5.py` cleans the three-ink peak (208 shirt specks filled, the old camp removed); `hatch5.py` builds the
  one-ink peak from the same drawing, the moss areas cut as gouge strokes.
- `round5.mjs`: a bigger A-frame tent with a lit door and the fire on the peak's axis, on a shoreline; water
  rows that open with depth inside an oval, with light lanes (mist on the three-ink shirt); the hawk facing the
  camp; the airy wordmark and a two-line tagline.
- `final5.mjs` + `finish5.py` + `prep5.py`: the kit, with the technician's print rules (voids and sub-1 mm
  cuts filled, nothing thinner than 0.4 mm, no specks, trapped screen separations, trimmed to the art plus
  3 mm, PNGs tagged 300 dpi). The back is now 10.22 x 8.47 in.
- Vercel image polish: two Flux Kontext edits (`edit.mjs`, $0.08) were not usable (one near-identical, one
  painterly with paper grain that can't print as flat ink). Image credit used: $0.62 of the owner's $0.75.

## Round 6 (2026-10-08)
Round 5 scored 7 (art director) and 8 (technician). Round 6: forest gouges carved into the three-ink moss; the
straight snow-band end recut on a diagonal (`polish5.py`); hand-cut water strokes (blunt entry, tapered exit)
over a shallower lake; a three-tongue flame with a lit core; pines stepping down beside the camp; a light cut
down the tent's shaded side; the hawk at 1.8 in with feather cuts; the tagline in weight 600.
Scores: art director 6, technician 7. Both found the drawn parts (camp, water, hawk) read as smooth vector
next to the hand-cut peak, and the print prep had real faults (below).

## Round 7 (2026-10-08): one hand, and the print prep fixed
Art (`round5.mjs`):
- One hand-cut wobble (an SVG displacement, about 0.015 in) on everything drawn in code: camp, shore, water, hawk.
- The flame is three uneven tongues growing out of the logs (round 6's read as a crown, floating). The meadow
  tufts are gone (they read as bollards); the rock is cleared about 2 mm round the tent and fire.
- One light lane, under the fire (the tent gives no light): bare shirt on one ink, mist strokes on three.
  Strokes shorten toward the edges, rows are unevenly spaced, and both shirts get the same strokes.
- The hawk sits higher, clear of the ridge; its feather cuts are gouges driven in from the trailing edge (closed
  cuts read as windows), with a 1.5 mm eye. Cuts are knockouts on both shirts.
- Tagline 86 px (caps about 5.3 mm), tracked so line 1 is as wide as the wordmark (7 in), 0.27 in below it.
Print prep (`prep5.py`, `finish5.py`, `final5.mjs`), each from a measured technician finding:
- The type is left as set (the round 5 fills closed the tagline's A and B counters; now 0.9 mm and open).
- True-radius discs everywhere: the 0.2 mm opening (round 6 rounded it to 2 px and left 0.34 mm necks) and the
  traps (0.3 mm under forest, 0.25 mm mist under moss; round 6's was 0.17 mm).
- Above the type, ink pieces under 2 mm2 or under 0.8 mm at their widest go (they lift off DTF film).
- The rules run three times, since thinning opens pinholes and filling makes necks.
- Film pinholes over a darker ink are filled; films tagged 300 dpi.
- `all-inks.svg` is traced from the untrapped shapes (round 6 traced the trapped films, so the spread light
  inks painted over 9.7% of the forest).
- Tracing at 3x (softened) with alphaMax 0.8: 5k px off the PNG instead of 14-17k, and half the sub-0.4 mm tips.
The back is now 10.26 x 8.22 in. Ink: one-ink 16.4 in2; three-ink 15.6 / 4.0 / 7.9 in2 (films, with traps).
Scores: art director 6 (one ink) / 7 (three inks); technician 8.

## Round 8 (2026-10-08)
Art, from the round 7 art director:
- The fire is the brightest thing in the camp: a light flame (mist, or bare shirt on one ink) keylined 1.2 mm
  in forest, three tongues at about 100/70/50%, a dark heart, behind two round-ended logs crossed at about 25
  degrees (the ember wedge that made them one bar is gone).
- The lake is laid out from the light lane outward, so it is even about the fire's axis; strokes thicken from
  1.45 mm to 2.75 mm toward the viewer; the lane carries the rows on as short broken strokes (mist, or forest
  on one ink), drawn outside the wobble that turned them into blobs.
- The tent has a second light cut. The hawk's near wing, a stub that read as a second beak, is the far wing's
  shape (with fingers) turned and mirrored onto the near shoulder at 72%.
- The lower-left snowfield's four forest tongues no longer repeat: one cut back, one broken, one drawn out
  (`polish5.py`, the cut ends rounded like a gouge's).
- Tagline: 640 from the variable Josefin Sans (`fonts.sh`), stems about 1.0 mm with the A counters 0.85 mm open
  (700 closed them to 0.7); 0.35 in under the wordmark, lines at 1.4x.
Print, from the round 7 technician:
- Traps in whole pixels (4 px = 0.34 mm under forest, 3 px = 0.25 mm mist under moss), never within 0.3 mm of
  bare shirt; knockouts under 1 mm beneath darker ink close on the films (no hairlines a screen can't hold).
- The prep repeats until stable; strokes that nearly touch and cycled between filled and thinned are bridged
  at 0.5 mm.
- Screen films (`out5/final/*-film*.png`, traced into the kit's per-ink SVGs) carry three registration
  crosshairs and a label: ink, hex, print order (mist, moss, forest) and RIGHT READING.
- `all-inks.svg` is stacked as it prints, mist then moss then forest, each from its trapped film: no butted
  edges, so no hairline seams.
