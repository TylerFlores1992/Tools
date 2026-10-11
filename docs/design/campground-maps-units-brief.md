# Campground maps: single units against the Forest Service's points (a batch's brief)

*2026-10-11. About 370 single-unit maps (a cabin, lookout, guard station or group site) are held,
mostly because nothing on the photo marks the pin. The Forest Service publishes its own point for
each recreation site (INFRA recreation sites, `EDW_RecInfraRecreationSites_02`, a federal work and
public domain). 258 held units match one by name or Recreation.gov id, a median 150 m from the pin.
This batch checks each match and moves the pin only where the photo or a lidar layer shows the
unit there. The orchestrating session records the first looks and decisions after a final check.*

**Everything in `campground-maps-fix-brief.md` applies**, above all its site-move rule. Read it first.

## Your list
- Each map in your list has a proposal in the session's `fs-cabins/proposals.json`:
  - the Forest Service's name and type for it;
  - `fs_xy`, its point in the map's coordinates;
  - `pin_xy`, the current pin;
  - `dist_m`, how far apart the two are.
- Render a box around both points with `aerial-grid.mjs` (5 m grid, at least 60 m of margin), over
  the photo. Where the canopy hides the ground, render it again with `GROUND=relief`, if the map has
  a layer in `.cache/pointcloud/`.

## The call
- **Move the pin to the Forest Service point** only when the photo or relief shows the unit at or
  within about 15 m of it:
  - a roof;
  - a cabin's clearing with a path or landing;
  - a lookout on its summit;
  - a group site's levelled pad or loop.
- Put the pin on the building or pad itself, not on the Forest Service point. Then call the map by
  the unit bar (the rollout child brief, step 3).
- **Leave the pin where it is** when the unit plainly shows at the current pin. Say so; the
  Forest Service point is the one that's off.
- **When neither spot shows anything,** don't move it. Call it `unsure` and say what each spot
  shows.
- **A point outside the map's frame** (`fs_xy` beyond ±half the frame): render around the point
  anyway. If the unit shows there, move the pin; the rebuild re-frames the map.
- **Never move a pin on the Forest Service point alone.** The point is evidence to look at, not an
  answer.
- **A moved pin makes the map's ground layer stale.** List those ids in your final message.

## The results file
- As in the fix brief, plus these fields:
  - `"fs": { "dist_m": <n>, "used": true|false }`;
  - `"saw": "what the photo or layer shows at the point and at the old pin"`.
