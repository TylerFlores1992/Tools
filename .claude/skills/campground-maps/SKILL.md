---
name: campground-maps
description: Drawing CampHawk's campground site maps in the lab (Recreation.gov from RIDB, ReserveCalifornia from California State Parks' data). Use when asked to "complete the maps", "finish the maps", "roll out the maps", "build a wave", "draw more campgrounds", "trace the missing roads", work the site-map "review queue", or when touching `studio/campground-maps/`, `src/lab/camphawk/round2/maps/`, `src/lab/camphawk/round2/admin/SiteMaps.tsx` / `TraceTool.tsx`, `public/private/camphawk/maps/`, `public/lab-local/`, RIDB exports, NAIP aerial photos, or State Parks' permission / Public Records Act request.
---

# Campground site maps: how to finish them

**Read `docs/design/campground-maps-playbook.md` first, all of it.** It is the plan: where it
stands, the rules, the tooling still to build, the wave loop, ReserveCalifornia after State Parks
answers, testing, doc updates and the owner's open decisions. This skill is the short list of
what must never be forgotten; the playbook is the procedure.

Then, for context: `docs/NEXT-SESSION.md` ("Campground site maps"), `docs/design/campground-maps.md`
(research, measurements, why), `studio/campground-maps/README.md` (commands).

## Before any work
1. `git fetch origin main`; read `docs/NEXT-SESSION.md` and the playbook's §1 and §10.
2. **Check the owner's Gmail (read only) for State Parks' answer** (`from:parks.ca.gov`, since
   2026-10-07). Never reply without the owner. An answer changes the plan (playbook §6.1).
3. **Probe the network first** (playbook §3.4: the host list and a one-line check). A `403` on
   CONNECT is the environment's policy: stop and ask the owner to set Network access to Full or to
   list every host there. Don't work around it.
4. Download the newest RIDB export into the scratchpad (playbook §3). Network commands need
   `NODE_USE_ENV_PROXY=1`. Never disable TLS or unset the proxy.

## The rules that cost the most if broken
- **A wrong map is worse than no map.** Unsure → "We haven't drawn a map of X yet".
- **Measured vs estimated, always said.** Shares come with a 95% interval (`wilson()`).
  Thresholds are fixed before results; a later change is said out loud.
- **Never commit State Parks' campsite data** (`public/lab-local/`, git-ignored) until they approve.
- **RC's own map pictures and positions are a private yardstick only**: never committed, drawn
  from or published.
- **No recreation.gov `/api` scraping.** RIDB (CC BY 4.0) only. **OSM is ODbL**: credit it; a road
  name from OSM is OSM data. **Never trace from Google, Esri or Bing**; NAIP is public domain.
- **Trace only what the photo shows**, and say what was left out in the trace's `note`. Check every
  trace over the photo after the rebuild.
- **The look:** `camphawk-design` / `ch-*` tokens; never colour alone (shape + word); ochre = yours;
  water is never blue.
- **campsite-finder (camphawk.app) is not changed from here** (playbook §9).
- Branch → PR → merge. `npm run verify` before every push; `npm run e2e` for UI; mutation-test new
  guards; `ui-audit` and a critic agent for anything a person uses; smoke after merge.

## The loop, in one line
Build a wave → automatic check → first look over the photo, every map → trace what's visible and
missing → rebuild → check traces over the photo → owner review → record the numbers in the docs.
Stop and ask the owner when a wave falls outside the sample's interval or a new failure shows up.

## Commands
```sh
NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-sample.mjs <ridb-dir> [id…]   # build / rebuild
node studio/campground-maps/aerial-check.mjs <out-dir> public/private/camphawk/maps/ridb-<id>.json
node studio/campground-maps/aerial-grid.mjs <map.json> <out.png> [x0 y0 x1 y1] [step] [width]
node studio/campground-maps/trace-from-grid.mjs <map.json> <spec.json>
```
Review page: `/private/camphawk/golden-hour/admin/site-maps` (`?id=`, `?show=`, `?tool=trace`).

## End of every session
Update the docs per the playbook's §8 table: results per wave in the design doc,
`docs/NEXT-SESSION.md`, this playbook if a process changed, the CLAUDE.md router if a pointer moved.
