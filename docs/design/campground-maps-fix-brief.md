# Campground maps fix-after campaign: a batch's brief

*2026-10-09. The owner, on the completion plan's decisions: "All of them" for the tracing campaign;
dispersed listings and the Alaska maps with no photo stay off. Every held or "usable" map whose
blocking cause a person can fix from the photo goes through one of these batches. The
orchestrating session gives each batch a list of maps, then records the first looks and decisions
itself after a final check. You are one batch: this file and the batch's list are your whole brief.*

## What you deliver
For every map on your list: look at it over the photo, fix what the photo shows is wrong or
missing, rebuild it, check the result over the photo, and give it a call and a note. Write the
results to the batch's results file (below). **Commit nothing and record no decisions.**

## The rules (read `docs/design/campground-maps-playbook.md` §2 too)
- **A wrong map is worse than no map.** When unsure, the call is `hold` or `unsure`, never `good`.
- **Trace only what the photo shows:** USDA NAIP, or the Forest Service's photos in Alaska (the
  scripts pick them). The lidar relief (`LIDAR=1`, USGS 3DEP or Oregon DOGAMI, public domain) may
  confirm a lane the photo half shows under trees. Never Google, Esri or Bing.
- **No recreation.gov `/api` scraping.** Never disable TLS or unset the proxy; network commands
  need `NODE_USE_ENV_PROXY=1`.
- **Never read an exit code through a pipe:** `cmd > log 2>&1; echo $?`, then read the log.
- **Touch only your list's maps:** `public/private/camphawk/maps/ridb-<id>.json`, your waves'
  manifests `public/private/camphawk/maps/waves/wave-NN.json` (the rebuild writes them), and
  `studio/campground-maps/traces/ridb-<id>.json`. Other batches work in the same checkout on other
  waves at the same time. Never run `git checkout`, `git stash`, `git reset` or `git add`, never edit
  code, docs, specs, first-look or decision files, and never rebuild a map that isn't on your list.

## Each map, most reserved first
1. **Look:** `NODE_USE_ENV_PROXY=1 node studio/campground-maps/aerial-check.mjs <dir> public/private/camphawk/maps/ridb-<id>.json`
   and read the PNG. Read the map's existing note (`first-look/wave-NN.json`) and its `cause`
   (your list). Zoom with `aerial-grid.mjs <map.json> <out.png> x0 y0 x1 y1 <step> 1400` (map
   metres); `LIDAR=1` in front draws the lidar relief instead of the photo.
2. **Fix, by the list's `job`:**
   - **`trace`** (`LANES_VISIBLE_UNDRAWN`, `ROADS_MISSING`, `ROADLESS_THIRD`,
     `LANES_UNDRAWN_UNSPECIFIED`, `ROAD_OFF_LANE`): trace the lanes the photo plainly shows and the
     map lacks (`trace-from-grid.mjs <map.json> <spec.json> "Claude (fix <batch>)"`; the spec format
     is in the script's header). **A drawn road off the visible lane** (`ROAD_OFF_LANE`): use
     `"replace": true` and trace every road the map needs, through roads marked `through`. Don't
     trace under full canopy, footpaths or faint spurs. Read coordinates off the grid in map
     metres, and keep each line on the lane's middle.
   - **`move`** (`SITES_MISPLACED`, `STACKED`, `ONE_SITE_OFF`, `FC_NOTHING_AT_PIN`): move a site
     (`"sites": [{ "name": "…", "at": [x, y] }]`) only onto a pad, cabin or campground the photo
     plainly shows as that site. For stacked sites, move only those whose own pad you can tell
     apart (numbered posts don't show; order along a lane and the listing's other sites do). For a
     first-come map with nothing at its pin, move the one site onto the campground the photo shows
     when it is plainly the one named (a single campground within about 1 km, no other nearby).
   - **A map that already has a trace:** read it first and put its roads, points and sites into your
     spec too: `trace-from-grid.mjs` writes the whole file, so anything you leave out is lost. Say
     in the note what you added. The file keeps the first tracer's credit.
3. **Rebuild:** `MAPS_NO_INDEX=1 OSM_FROM=auto NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-wave.mjs <ridb-dir> studio/campground-maps/specs/wave-NN.json <id> > b.log 2>&1; echo $?`
   (one build at a time per batch; the remote services slow down past three at once).
4. **Check the result over the photo** (aerial-check again): every traced line within about 3 m of
   the lane's middle, every moved site on its pad. Fix and rebuild until it is, or remove your trace
   (delete the file, or rewrite the earlier one) and rebuild.
5. **Call it** by the bar in `docs/design/campground-maps-rollout-child.md` (each wave, step 2;
   single units step 3; first-come step 3b): `good`, `usable`, `hold` or `unsure`. **The usable bar:**
   a drawn road off the visible one, misplaced or stacked sites, or about a third or more of the
   sites with no drawn road make it `hold`.
6. **Write the result** at once (so nothing is lost if you stop): add to the results file
   `{ "<id>": { "call": "usable", "note": "…", "traced": true, "moved": 0, "minutes": 12 } }`.
   The note is one or two plain sentences of what the map shows now and what you did, naming loops
   and site numbers, in the style of the existing first-look notes. US spelling.

## When you're done
Your final message: counts of calls (before and after), the ids you traced or moved, any map you
couldn't rebuild and why, and anything new (a failure mode, a source that stopped answering).
