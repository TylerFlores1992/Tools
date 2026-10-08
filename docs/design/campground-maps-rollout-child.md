# Campground maps rollout: a child session's brief

*2026-10-08. The owner asked to "orchestrate the rest of rec.gov maps, each batch to a child",
with the orchestrating session making the final check, passing what is acceptable and holding the
rest. You are one of those children. This file is your whole brief, together with the spawn
prompt (your batch name and waves). Nobody can message you while you work, and nobody will answer
a question: when something blocks you, write it in your handoff and move on to the next wave.*

## What you deliver
Your batch's waves, each **built, looked at over the aerial photo, and traced where the photo
shows what's missing**, on your branch, pushed. The orchestrating session merges it, checks it,
and records each map's decision. **You record no decisions.**

## The rules (from the playbook, §2; read it)
- **A wrong map is worse than no map.** When unsure, the call is `hold` or `unsure`, never `good`.
- **Trace only what the NAIP photo shows.** Never from Google, Esri or Bing. Never name a road from
  OpenStreetMap unless the map credits OSM.
- **No recreation.gov `/api` scraping.** RIDB only.
- **Never disable TLS or unset the proxy.** Network commands need `NODE_USE_ENV_PROXY=1`.
- **Never read an exit code through a pipe:** `cmd > log 2>&1; echo $?`, then read the log.
- **Commit before experimenting;** revert by edit, never `git checkout -- <file>`.

## The files you may change (and no others)
For each of your waves `NN`:
- `public/private/camphawk/maps/ridb-<id>.json`: the maps (new)
- `public/private/camphawk/maps/waves/wave-NN.json`: the wave's manifest
- `src/lab/camphawk/round2/maps/first-look/wave-NN.json`: your first look
- `studio/campground-maps/traces/ridb-<id>.json`: your traces
- `studio/campground-maps/splits/wave-NN.json`: your split calls
- `.handoff/maps-<batch>.md`: your report

**Never** edit `waves.json`, `first-look/index.ts`, `decisions.ts`, anything in `decisions/`,
`splits.json`, the specs, any code, or any doc. The orchestrator regenerates the indexes
(`lab-index.mjs`) when it merges. **Never open a PR. Never push to `main`.** Push only to your
branch (the spawn prompt names it).

## Setup (once)
1. `npm ci`.
2. Probe the network (playbook §3.4's host list and one-liner). A `403` on CONNECT means the
   environment's network is restricted: write that in the handoff and stop.
3. The RIDB export: download
   `https://ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip` into your scratchpad and unzip
   it. Note its date in the handoff (the specs were planned on the 2026-10-07 export; a few sites
   may differ, and that is fine).
4. `apt-get install -y osmium-tool` (if `osmium` isn't there).
5. Your OpenStreetMap extract (the spawn prompt names it):
   `NODE_USE_ENV_PROXY=1 node studio/campground-maps/osm-extract.mjs <extract> > osm.log 2>&1; echo $?`.
   It's resumable; run it again if it stops. It takes from minutes to about an hour. **A batch with
   an `api` wave** (Alaska, Hawaii) needs no extract for that wave: `build-wave.mjs` reads the spec
   and uses the OSM API.

## Each wave, in order
1. **Build:**
   `MAPS_NO_INDEX=1 NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-wave.mjs <ridb-dir> studio/campground-maps/specs/wave-NN.json > build-NN.log 2>&1; echo $?`.
   Retry the failures once with their ids after the spec. List any still failing in the handoff.
   **Commit and push** (maps and manifest).
2. **First look, every map, over the photo** (playbook §5 step 3):
   `NODE_USE_ENV_PROXY=1 node studio/campground-maps/aerial-check.mjs <dir> public/private/camphawk/maps/ridb-<id>.json …`,
   then **read every PNG**. Zoom any frame wider than about 1 km with
   `aerial-grid.mjs <map.json> <out.png> x0 y0 x1 y1 <step> 1400` before calling it.
   - **The call**, one of:
     - `good`: sites on visible pads, roads on visible roads, nothing missing;
     - `usable`: sites right and a few lanes missing: at most about 1 site in 7 without a drawn road
       within about 20 m, and every drawn road on a visible one. More than that is `hold`, even when
       the rest is good (the final check holds these; set 2026-10-08 after two batches drifted);
     - `hold`: not usable as drawn (sites off the pads, roads wrong, a loop with nothing drawn);
     - `unsure`: the photo can't tell (canopy, no photo).
   - **The note:** one or two plain sentences of what you saw, naming loops and site numbers.
     Read the existing `first-look/wave-01.json` and `wave-02.json` for the style.
3. **Single units** (waves whose spec says `"kind": "units"`): each map is one cabin, lookout,
   guard station or group site, on a 1.4 km frame. Zoom on the pin:
   `aerial-grid.mjs <map.json> <out.png> <x-150> <y-150> <x+150> <y+150> 10 1000`, where `x y` is
   the unit's point (`sites[0].at`).
   - `good`: the pin is on a building, tower or clearing that is plainly the unit, and a drawn road
     or trail reaches it;
   - `usable`: the pin is right, but no drawn road or trail reaches it;
   - `hold`: the pin is on nothing that could be the unit (open water, a slope, the middle of a
     forest with no clearing), or the check says the listing's own point is far away and the photo
     agrees with the listing's point;
   - `unsure`: canopy, or no photo.
   Don't trace for a unit unless a road to it is plainly visible and undrawn.
4. **Split listings** (several places under one name): the build shows a listing as areas when its
   sites spread over 1.5 km. If the photo shows several separate places inside 1.5 km, add a call
   to `studio/campground-maps/splits/wave-NN.json`:
   ```json
   { "version": 1, "about": "Split calls from the first look of wave NN.",
     "listings": [ { "id": "233539", "split": true, "by": "First look (Claude, rollout <batch>)", "on": "YYYY-MM-DD", "note": "Four areas on separate fingers of the lake." } ] }
   ```
   Then rebuild that id and run `aerial-check.mjs` on it again: each area's frame is drawn dashed
   and numbered. If one frame holds several separate clusters, add `"gap": 150` (or 120, 100, 80:
   the metres between clusters) to the call. For lettered loops that run on without a gap, use
   `"maxSpan": 400`. Rebuild, look again. Say how the areas look in the note.
   **A call the area rules can't honour fails a test** (`npx tsx --test scripts/campground-maps-wave.test.mts`):
   then drop the call and say so in the note.
5. **Trace what's missing and visible** (playbook §5 steps 5 and 6): `aerial-grid.mjs`, then
   `trace-from-grid.mjs <map.json> <spec.json>`, then rebuild those ids, then **check every trace
   over the photo** and fix any more than about 3 m off. Don't trace under full canopy, footpaths,
   or faint spurs. Update the call and note to say what was traced.
6. **Write `first-look/wave-NN.json`:**
   `{ "version": 1, "wave": NN, "by": "Claude (rollout <batch>)", "on": "YYYY-MM-DD", "looks": { "<id>": { "call": "good", "note": "…" } } }`,
   one entry for **every** map in the wave's manifest (failed builds have none).
7. **Check:** `npx tsx --test scripts/campground-maps-*.test.mts src/lab/camphawk/round2/maps/*.test.mts > t.log 2>&1; echo $?`
   (expect the index-sync test to fail, because the indexes are regenerated on merge; anything
   else failing is yours to fix). **Commit and push.**
8. **Append the wave to `.handoff/maps-<batch>.md`** and push:
   ```
   ## Wave NN (<region>, <multi|units>)
   - Built N, failed N (ids and why)
   - Check: ready N, review N, not drawn N
   - First look: good N, usable N, hold N, unsure N
   - Traced: <ids>
   - Split calls: <ids>
   - Held, and why (one line each): <id>: <reason>
   - Anything new (a failure mode, a source that stopped answering)
   ```

## When you're done
Add `STATUS: complete` as the last line of the handoff, with how long each wave took, and push.
If you stop early (a blocker, the disk, the quota), write `STATUS: stopped at wave NN: <why>`
and push what you have. **Everything not pushed is lost when your session ends.**
