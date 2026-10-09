# Campground maps canopy campaign: a batch's brief

*2026-10-09. About 670 maps are held, or pass only as "usable", because tree canopy hides their
lanes on the photo. USGS's lidar point clouds show those lanes (research:
`research/campground-maps-pointcloud.md`; tool: `studio/campground-maps/pointcloud/`, README
"Ground from lidar point clouds"). Each batch traces a list of canopy maps over those layers. The
orchestrating session records the first looks and decisions after a final check.*

**Everything in `campground-maps-fix-brief.md` applies.** Read it first: the rules, the files you
may touch, the call bar, the results file, and never committing. This brief adds what's different.

## The layers
- `GROUND=intensity`: how brightly the ground returned the laser. Asphalt is dark and gravel is
  light, so a paved or gravel lane shows as a continuous band under full canopy, with its pull-in
  pads. Trees, grass and litter are mottled.
- `GROUND=relief`: the bare earth at 0.5 m from the ground points. It shows crowned lanes, ditches
  and levelled pads, and it helps where intensity is weak (dirt lanes).
- Use them with `aerial-check.mjs` and `aerial-grid.mjs`:
  - `GROUND=intensity NODE_USE_ENV_PROXY=1 node studio/campground-maps/aerial-grid.mjs <map.json> <out.png> x0 y0 x1 y1 5 1400`
  - The same box without `GROUND` gives the photo; compare the two.
- **The layers are already made** for your list (`studio/campground-maps/.cache/pointcloud/ridb-<id>/`).
  If one is missing, the script says so: put the map in your results as `unsure` with the note
  "no ground layer yet" and go on. Never run `ground.py` yourself: one background job makes them, so
  the disk isn't overrun.
- `meta.json` beside the PNGs gives the survey and its ground points per m². Under about 1.5,
  lanes rarely show.

## Tracing over them
- **Trace a lane only where a layer shows it plainly as a continuous band** that joins the road
  network, and where the photo agrees wherever the canopy opens (a gap, a parked car, a pad).
  Creek banks, ditches alone, old tracks and field edges look like lanes in relief: a lane leads to
  the sites, has pads off it, and usually shows in intensity too.
- **Keep each line on the band's middle, within about 3 m.** Work on 5 m grids in boxes of about
  150 m.
- **A drawn road off the band** is fixed with `"replace": true`, tracing every road the map needs.
  Through roads are marked `through`.
- **Run `trace-from-grid.mjs` with the same `GROUND=`** you traced over, so the trace credits the
  point clouds. Trace credit `by`: "Claude (canopy <batch>)".
- **Sites stay where the listing puts them,** unless the fix brief's move rule plainly applies.
- **Check after the rebuild over the layer you traced on, and over the photo where it opens.** Then
  call the map by the usable bar. A canopy map is `usable` once its drawn roads follow the bands
  and fewer than about a third of its sites have no drawn road. It's `good` when nothing is
  missing.
- **When the layers show nothing** (faint dirt lanes, a sparse survey), the call is `unsure` or
  `hold`, with a note saying which loops can't be placed and why (`meta.json`'s density).

## The results file
As in the fix brief, plus `"ground": "intensity|relief|both|none"` (what you traced over) and
`"density": <ground points per m²>` from meta.json.
