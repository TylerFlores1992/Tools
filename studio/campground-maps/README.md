# Campground site maps

CampHawk's own campground maps, drawn from public data. Nothing is copied or traced from a
provider's map picture. Plan, research and the per-provider route: `docs/design/campground-maps.md`.

```sh
# 1. RIDB full export (no key, 248 MB zip, ~440 MB unzipped; don't commit it)
curl -LO https://ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip && unzip RIDBFullExport_V1_CSV.zip -d ridb
# 2. Build one campground (RIDB facility id; 232447 is Upper Pines)
node studio/campground-maps/build.mjs ridb 232447
# → src/lab/camphawk/round2/maps/ridb-232447.json (about 45 KB)
```

The script fetches the rest live. Add the campground to `MAPS` in
`src/lab/camphawk/round2/maps/index.ts`.

## The 50-campground sample (2026-10-07)

```sh
# 1. Draw the sample (no network; seeded, so it re-draws exactly) → specs/ridb-sample.json
node studio/campground-maps/sample.mjs ridb
# 2. Build all 50 and run the automatic check on each (NODE_USE_ENV_PROXY=1 in a session container)
NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-sample.mjs ridb
#    → public/private/camphawk/maps/ridb-<id>.json (served to signed-in lab visitors only)
#    → src/lab/camphawk/round2/maps/sample-manifest.json (verdicts, checks, thumbnails)
# 3. Optional: each map over the aerial photo, as PNGs, for a person to judge
node studio/campground-maps/aerial-check.mjs /tmp/aerial public/private/camphawk/maps/ridb-*.json
# Rebuild only some (after adding a trace, say); the rest of the manifest is kept
NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-sample.mjs ridb 233411 10243253
```

The lab's review page is `/private/camphawk/golden-hour/admin/site-maps`. What the sample found
is in `docs/design/campground-maps.md`.

- **`build.mjs` is one function for both** (`buildRidbMap`). Each layer comes from one source,
  never merged:
  - **Roads: the source the sites sit along** (`roads.mjs`, tested). All four are fetched (Park
    Service, OpenStreetMap, Forest Service, Census TIGER), and the one with the shortest "9 in 10
    sites within" distance wins, unless the usual order's pick is within 5 m (or a quarter) of it.
    Each map records every source's fit and the reason in `sources.roadPick`.
  - Trails, parking and buildings: the Park Service's when its roads were picked, else OSM's.
  - Restrooms and water taps per kind; lakes and rivers from USGS, or OpenStreetMap when USGS
    doesn't answer (recorded in the map's `sources.water`).
  - **Then the map's trace, if it has one** (below).
- **`qa.mjs` is the automatic check** (tested in `scripts/campground-maps-qa.test.mts`, 19 of 19
  mutants killed). Its thresholds were fixed before the sample was built. Its eighth check holds
  any map with traced roads or points for a person to approve.

## Traces: roads and points no source has (`traces/`, `trace.mjs`)

`traces/ridb-<id>.json` is what a person traced from the aerial photo (USDA NAIP, public domain,
so it's our own work). The review page's **Trace what's missing** tool downloads exactly this file.
To put one on the map, add it here and rebuild that campground (command above).

```json
{ "version": 1, "map": "ridb-233411", "traced": "2026-10-07", "by": "…", "photo": "USDA NAIP via USGS The National Map (public domain)",
  "roads": [{ "coords": [[lon, lat], …], "name": "optional", "through": false }],
  "points": [{ "type": "Restroom", "at": [lon, lat] }], "replace": false, "note": "what was left out and why" }
```

- **Roads add to the source's.** A traced road is a campground road (thin) unless `through`.
- **`replace: true` makes the trace the map's only roads**, for a source that has the roads but in
  the wrong places (Lost Creek). Trace every road then, and mark the through roads.
- **The build stops on a bad file** (another map's, a road far outside the frame, an unknown point
  type): a trace that silently fails to apply is a map that silently keeps its gap.
- Trace only what you can see on the photo, and say in `note` what you left out.
- **A build waits mostly on remote services.** On 2026-10-07 USGS's hydrography service timed
  out for hours; each campground spent up to 90 s on it before falling back. Three build at once.
- **OpenStreetMap's API is for editing, not bulk reads.** Fifty small requests is within its
  usage policy; a rollout reads a Geofabrik extract instead (unreachable from session containers
  on 2026-10-07, like Overpass).

## Sources and terms (checked 2026-10-07)

| Layer | Source | Terms |
|---|---|---|
| Site points, type, accessibility, max vehicle length, people, shade | RIDB full export, `Campsites_API_v1.csv` + `CampsiteAttributes_API_v1.csv` | CC BY 4.0 (data.gov record). Credit Recreation.gov; don't imply endorsement. |
| Campground roads, restrooms, kiosk, parking, shuttle stop, trails | NPS national datasets, `mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_*_Geographic` | Federal government data. The service credits "National Park Service". |
| Lakes and rivers | USGS NHD, `hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer` (layers 6, 9, 12) | US government work (USGS). |
| Roads, paths, restrooms, water taps, parking, campground outlines, numbered pitches (where the Park Service has none) | OpenStreetMap API (`api.openstreetmap.org/api/0.6/map`) | ODbL 1.0. Every map that uses it says "© OpenStreetMap contributors". The OSM-derived layers in the map JSON files are offered under ODbL. |
| Forest Service system roads (when they fit best) | `apps.fs.usda.gov/arcx/rest/services/EDW/EDW_RoadBasic_01/MapServer/0` | US government work. |
| Census TIGER roads (when they fit best) | `tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer` (layers 2, 6, 8) | US government work (Census Bureau). |
| Roads and points traced by a person | `traces/`, from the USDA NAIP photo | Our own work, from a public-domain photo. |
| Aerial photo (review and tracing only, never drawn on a camper's map) | USDA NAIP via `imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer` | Public domain. Loaded live by the review page; nothing is committed. |

**Never used:** recreation.gov's own `/api/camps` endpoints (robots.txt disallows `/api/*`,
and its terms ban scraping), provider map images, and Google, Esri or Bing imagery for tracing
(their terms forbid it outside OSM).

## Known gaps in the data

- RIDB writes `0` for facts it doesn't have (driveway length, site size). The build drops
  zeros instead of showing "0 ft".
- RIDB points are the provider's own placement. Spot checks show sites along the NPS loop
  roads, but nobody has surveyed them. The map says "positions are approximate".
- 19% of Recreation.gov campsites have no point (measured on the 2026-10-06 export: 106,502 of
  130,763 have one). Those campgrounds get the "no map yet" state.

## ReserveCalifornia campgrounds: `build-csp.mjs` (local only, pending permission)

```sh
NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-csp.mjs studio/campground-maps/specs/jedediah-smith.json
# → public/lab-local/csp-jedediah-smith.json (git-ignored; the lab page loads it on a local run)
```

- **Site points:** California State Parks' campsite layer (ArcGIS item
  `f0374d8702f14ad5962023c7a502da65`, service `InternalCampsiteSpur`). **Its GIS terms ask for
  approval before commercial use, so the output must never be committed (this repo is public) or
  deployed until State Parks approves.** The permission and records requests were sent on
  2026-10-07 (docs/NEXT-SESSION.md has what to do when they answer).
- **Which units exist, and their loops:** RC's own unit list (its `search/grid`, the list
  CampHawk's availability check reads), with a loop name per RC area in the spec. These are
  facts; nothing from RC's map pictures is used.
- **Roads, paths, restrooms, water, dump station:** OpenStreetMap (ODbL, credited on the map).
- **River:** USGS NHD.
- **Matching** (`match.mjs`, tested): kinds must agree, so RC's cabin "J24" is State Parks' cabin
  "24". A number State Parks records twice, or not at all, is left off and listed, never guessed.
  Hike-in and boat-in units are not drawn.
- **`NODE_USE_ENV_PROXY=1` is required in a session container.** Without it Node bypasses the
  proxy and RC's firewall answers 403.
- Every source must answer 2xx or the build stops; answers are cached in `.cache/` (git-ignored).
