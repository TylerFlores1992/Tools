# Campground site maps: research, plan and first mockup

*2026-10-07. Lab only: nothing here changes camphawk.app. Mockup:
`/private/camphawk/golden-hour/campground` (Upper Pines; lab switch `?map=none` shows the
"not drawn yet" state, `?booking=first-come` the map without availability). Build tooling:
`studio/campground-maps/`.*

**To finish the maps, follow `docs/design/campground-maps-playbook.md`** (the plan, rules, wave loop,
testing and doc updates). This file is the research and the record of what was found.

## The short answer (updated 2026-10-07, afternoon)

**Both providers can be drawn from real survey data. Recreation.gov's is open now, and
California State Parks' needs their permission first.**

- **Recreation.gov:** RIDB publishes campsite coordinates under CC BY 4.0. Ready now.
- **ReserveCalifornia:** RC itself publishes no coordinates, only spots on its map pictures.
  **But California State Parks publishes its own campsite points**: 11,334 of them, with
  site numbers and parking-spur sizes, updated weekly. They are on its public ArcGIS account
  (item `f0374d8702f14ad5962023c7a502da65`, layer `InternalCampsiteSpur`).
  - Its GIS terms ask for approval before commercial use. So it is used only on a local run, and
    it is never committed to this public repository or deployed. Both requests were **sent 2026-10-07**
    from the owner's Gmail: permission (geodata@parks.ca.gov) and a Public Records Act request
    (Parks.PRA@parks.ca.gov), whose 10-day answer is due by about 2026-10-17.
  - **It is more accurate than RC's own maps.** Its points sit a median 1-9 m from the real
    campground roads (checked against OpenStreetMap at 11 campgrounds). RC's drawings are partly
    schematic, 3-30 m off.

Full RC findings, the private check against RC's maps, and the time estimate are in
"ReserveCalifornia: the State Parks campsite layer" below.

**The Recreation.gov sample is done (2026-10-07, evening).** Of 50 random campgrounds with two or
more sites, the automatic check passed **32 (64%; 50–76% across all 2,196)**. Looking at all 50
over the aerial photo, none it passed was unusable, but 12 of those 32 are missing some
campground roads. 6 of the 18 it held were fine. **After one look, 38 of 50 (76%; 63–86%) can go
live.** RIDB's site points were right wherever the pads could be seen; **the gap is roads**.
Details: "The 50-campground sample" below. Review page: `/private/camphawk/golden-hour/admin/site-maps`.

**Then the roads were fixed (2026-10-07, night): 45 of 50 (90%; 79–96%) can go live after one
look.** Each map now draws its roads from the source the sites actually sit along (pick by fit,
four sources), and a tracing tool on the review page lets a person draw what no source has, over
the aerial photo. A session traced the missing roads on 13 sample maps. Traced roads always wait
for a person to approve them, so fewer maps are ready *on their own* (27); the five left are three
listings that aren't one campground, one under full canopy, and one where no lanes are visible.
Details: "Roads: picked by fit, then traced" below.

## What exists, per provider (measured 2026-10-07)

### Recreation.gov (RIDB): ready now
- **RIDB full export:** `ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip`, no key needed,
  dated 2026-10-06. License: **CC BY 4.0** (data.gov record). Credit Recreation.gov, and don't
  imply endorsement.
- **Coverage, campgrounds only, staff sites excluded:**
  - 120,274 bookable campsites in 4,928 campgrounds.
  - **101,087 (84.0%) have a latitude/longitude.**
  - **3,623 campgrounds** have a point for at least 90% of their sites.
  - Upper Pines: 235 of 235 bookable sites placed.
- **Per-site facts:** type, accessibility, max vehicle length, number of people, back-in or
  pull-through, shade, and more.
  - RIDB writes `0` for "not recorded", so a zero must never show as "0 ft".
- **No geometry in RIDB.** It has no roads, loops or restrooms. Those come from elsewhere:
  - **National Park Service:** national roads, buildings, POIs, parking and trails. At Upper
    Pines this was all of it: 21 campground road segments, 10 restrooms, the kiosk and the
    shuttle stop.
  - **Forest Service (EDW):** at Dimond O it gave one road, the campground's access road, and
    no loops. OpenStreetMap there had 3 service roads, 2 toilets and 3 pitches.
  - So most Forest Service and Army Corps campgrounds will have site points plus partial
    roads. The map must look right with only what exists, and never invent a loop.
- **Don't use recreation.gov's own `/api/camps` endpoints**, even though they answer without a
  key. Robots.txt disallows `/api/*`, and the terms ban scraping and claim the compilation.
  RIDB is the sanctioned source.
- **CampHawk already reads RIDB** (`src/lib/sources/ridb/client.ts` has `CampsiteLatitude` and
  `CampsiteLongitude`), but the `campsites` table has no columns for them, so they're dropped
  at sync.
  - `docs/CONTEXT.md` says "providers don't expose per-site coordinates". That's wrong for
    Rec.gov and belongs on the CampHawk issue list.
- **RIDB's facility pin can be far from the campground.** Dimond O's facility point is about
  4 km from its 26 campsites. Frame maps on the sites, never on the facility point.

### ReserveCalifornia (Tyler/UseDirect RDR): blocked on permission or survey
- **Units carry no real coordinates.** `search/grid` returns a `MapInfo` per unit with
  `Latitude/Longitude = 0.0`.
  - The agent found this in 13 sampled facilities, and I re-checked one myself: Huckleberry
    Campground, 30 of 30 units at 0.
  - Each unit has a pixel X/Y on RC's own JPG map. Those pixels are derived from their
    artwork, so **don't use them**.
- **RC's terms text couldn't be retrieved** (the page is rendered by the app). The parent
  site's terms (parks.ca.gov Conditions of Use) forbid "spider or other automatic device" and
  "copying, republishing or display of any content".
- **CA State Parks GIS** (`parks.ca.gov/?page_id=29682`):
  - The GIS data page has **no campsite layer**: 531 campground points (one per camp area),
    plus roads, trails and 3,246 buildings, including comfort stations. ~~So no campsite data
    exists.~~ **Wrong: a campsite layer is published separately on State Parks' ArcGIS account;
    see the section below.**
  - License: *"intended for free distribution for personal or public sector use. Commercial uses
    … must be approved by CSP in advance, contact geodata@parks.ca.gov."* CampHawk is
    commercial, so **ask first**.
- **OpenStreetMap** has almost no RC campsites: 1 pitch at Doheny (107 sites), and 0 at
  Jedediah Smith, Moro, Pfeiffer Big Sur and San Elijo. It does have restrooms and roads at
  some parks.
- **Facts vs artwork:** site numbers, which loop they're on, and the existence of a restroom are
  facts (*Feist*). Brochure and RC artwork, and positions measured off it, are not. *Not legal
  advice: if RC is the priority, a lawyer's hour is cheap insurance.*

### The other providers CampHawk watches
GoingToCamp, ReserveAmerica, TNSC and the other UseDirect states are untested. Each needs the
same check: does the API carry per-site coordinates, what do the terms say, and is there
open GIS? About an hour per provider.

## ReserveCalifornia: the State Parks campsite layer (2026-10-07, afternoon)

### What it is
- California State Parks publishes campsite points on its own ArcGIS account: item
  `f0374d8702f14ad5962023c7a502da65` ("03. Camping"), service `InternalCampsiteSpur`.
  - **11,334 points across 120 park units.** Each carries the site number, type, parking-spur
    length and width, and the campground name.
  - Its description says "Update Schedule: Weekly on Fridays". The newest edits were about a
    week before this reading.
  - It is public, with an empty license field. Its name says "Internal", so it may have been
    shared by mistake. **Ask before relying on it.**
- **Permission:** State Parks' GIS page asks for approval before commercial use. Two requests
  were **sent 2026-10-07** from the owner's Gmail:
  - **Permission**, to geodata@parks.ca.gov. It names the layer, how it would be used and
    credited, asks whether it is meant to be public, and asks who owns RC's map artwork.
  - **Public Records Act request**, to Parks.PRA@parks.ca.gov. It asks for the layer and any
    campsite GIS or site plans.
    - The agency must answer within 10 days, extendable by 14 (Gov. Code §7922.535).
    - Fees for electronic records are limited to direct cost (§7922.575).
    - Release can't be tied to a license (*County of Santa Clara*, 2009).
    - A GIS database is a public record, not exempt software (*Sierra Club*, 2013).
  - **Not legal advice.**
  - **Answer due:** by about 2026-10-17 for the records request; the permission email has no deadline.
- **Until State Parks approves, its data stays out of this public repository and every deploy.**
  `build-csp.mjs` writes to `public/lab-local/` (git-ignored). Deployed, the page shows the
  not-drawn state.

### How accurate it is (measured)
- **Against real roads:** at 11 campgrounds, State Parks' points sit a median 0.8-9.5 m from the
  nearest OpenStreetMap campground road. They hug the loops on both sides, where parking spurs
  are. At Jedediah Smith, under redwoods, the 1 m USGS elevation data shows the same loops
  faintly.
- **Against RC's own maps (option 6, private yardstick, never published):**
  - **Method:** for each RC area, fit the best scale, rotation and shift from RC's map-picture
    positions to State Parks' points, then measure what's left.
  - **Result:** typical gap 13 m across 197 RC areas. Where RC's drawing is near to scale the
    two agree closely: Hearst San Simeon/Washburn 3.4 m, Doheny 5.0 m, Carpinteria 7.3 m.
  - Elsewhere RC's drawings are partly schematic, 20-30 m off: Jedediah Smith 13-19 m,
    Pfeiffer Big Sur 27 m, Elk Prairie 30 m. The road check above shows it is RC's drawing that
    is off, not State Parks' points.
  - **So State Parks' data is more accurate than RC's own maps.**
- **What option 3 (aerial photos and elevation data) can and can't do:**
  - The aerial photo shows nothing under the Jedediah Smith canopy.
  - The 1 m elevation data shows the loop roads faintly. It does not show individual site pads.
  - It cannot say which numbers sit where without a fact source.
  - **So option 3 is the fallback for campgrounds State Parks hasn't mapped. It is not the plan.**

### Coverage across every RC area in CampHawk's catalog (measured)
Matching rules are in `match.mjs`: same kind (cabin to cabin), same number, and RC's letter
prefix allowed onto a plain number (Leo Carrillo "L006" is State Parks' "6"). Oceano Dunes' 1,067
off-road-vehicle "units" are left out, since they are not campsites.

| | RC areas | sites | share of sites |
|---|---|---|---|
| Drawable sites (hike-in and boat-in excluded) | 341 | 7,921 | |
| Matched to a State Parks point | | **6,926** | **87%** |
| **Automatic:** 90%+ matched and agrees with RC's layout (median under 35 m) | 150 | 5,033 | 64% |
| **Review:** mostly matched, or a larger gap to check | 48 | 1,659 | 21% |
| **Manual:** few matches or large gaps | 17 | 560 | 7% |
| **No State Parks points** | 126 | 669 | 8% |

- **No points**, mostly:
  - small cabin and group areas;
  - Big Basin, still rebuilding after the 2020 fire;
  - Mt. San Jacinto and Mount Diablo.
- **Unmatched although points exist:** Humboldt Redwoods' camps (Hidden Springs, Burlington,
  Albee Creek), where site numbers repeat across camps. A per-area spec, like Jedediah Smith's,
  fixes these.
- **Two numbering faults found in State Parks' data:** Jedediah Smith has two site 56s and no
  57. The build leaves such sites off and lists them, never guessing. They are worth reporting
  back to State Parks.

### The mockup
`?id=jedediah-smith` on a local run: 75 of RC's 82 units drawn. Site 56 is left off (recorded
twice) and so is 57 (no point), and the 5 hike-in pads are left off by design. Cabins J24, J26,
J30 and J105 sit on their real spots. Restrooms, water and the dump station come from
OpenStreetMap.

## How long all of Recreation.gov and ReserveCalifornia would take (estimate, 2026-10-07)

The work, in order. Times are focused working sessions, not calendar days.

1. **Bring it into CampHawk** (campsite-finder): about 1.5-2 weeks.
   - **Database:** a migration for site coordinates, spur sizes and loop. The RIDB sync keeps the
     coordinates it already reads.
   - **Builder as a weekly job,** for Recreation.gov and later State Parks:
     - OpenStreetMap from a Geofabrik extract, not the rate-limited API;
     - output stored in Supabase Storage or R2;
     - an automatic QA gate (match rate, distance to roads, duplicates);
     - a small admin review page.
   - **Port the site map** into CampHawk's campground page, wired to real per-site availability,
     with tests and a UI audit.
   - **Gated on the owner's go-ahead:** the lab's standing rule is not to start camphawk.app work
     before Apple accepts the current app build.
2. **Recreation.gov rollout:** about 2-3 days of batch runs plus review, and the road gap below.
   - 3,212 overnight campgrounds have points for 90%+ of their sites (the earlier "3,623" counted
     411 day-use facilities). 1,016 of them are one unit, a cabin or lookout, and need no site map.
   - **Measured on a 50-campground sample (section below):** about 64% of the 2,196 multi-site
     campgrounds pass the check on their own (1,100–1,670), about 12% more pass after a person's
     look, and about 24% (roughly 300–800) need roads added or the listing split before a map is
     usable.
   - Review time per map was not measured.
3. **ReserveCalifornia rollout,** once State Parks approves or the records request delivers:
   about 3-5 days.
   - The same pipeline: 150 areas are automatic, 48 need review, 17 need hand work. The 126 areas
     with no points stay "not drawn yet", or get option 3 later.
   - **Calendar time depends on State Parks.** The records request has a legal 10-day answer
     (plus up to 14); the permission email has no deadline.

**Total:** roughly 3-4 weeks of sessions for both, with RC's start set by State Parks' reply.

## Options for ReserveCalifornia (owner's call)

1. **Ask State Parks.** Email geodata@parks.ca.gov for (a) commercial-use approval for the GIS
   layers and (b) whether they hold campsite points or CAD site plans they'd share. Cost: one
   email and a wait. Best outcome: official data, no gray area.
2. **Draw from public-domain aerial photos.** USDA NAIP is public domain, 0.6–1 m. Loops, pads
   and parking spurs show in open campgrounds like San Elijo, Doheny and Moro. Under redwood or
   oak canopy (Jedediah Smith, Big Sur) individual sites **won't** be visible, so those maps
   would be loop-level only.
   - Site numbers come from RC's unit list (facts), and their placement along a loop would be
     our estimate, labeled as approximate.
   - Effort: about 30–90 minutes per campground in QGIS, for about 280 parks.
3. **Contribute to OpenStreetMap**, then draw from OSM. The same tracing work, shared with
   everyone. ODbL means our derived site database must also be offered under ODbL (the map
   images themselves can stay ours).
4. **Ship RC without maps** for now, as camphawk.app does today: "We haven't drawn a map of X
   yet", with a link to the provider's map (built in the lab).

Recommendation: **send option 1 now and build Rec.gov meanwhile**. If State Parks says no or
doesn't answer, do option 2 for the most-watched RC campgrounds first. CampHawk's watch counts
say which ones.

> **Superseded the same afternoon:** State Parks turned out to publish its own campsite layer
> (section above). Option 1 is now "permission for that layer", plus a records request in
> parallel. Option 2 (aerial photos and elevation data) is only the fallback for the 126 areas it
> doesn't cover.

## The pipeline (proven on one campground)

`studio/campground-maps/build.mjs` (works now):
1. Read RIDB sites and attributes for a facility.
2. Project to local metres (north up).
3. Fetch NPS roads, restrooms, parking and trails, and USGS water, for a frame around the sites.
4. Clip everything to the frame and place labels.
5. Write about 45 KB of JSON.

The lab draws it as SVG with HTML labels, so type stays readable at every size.

**At scale (about 3,600 campgrounds):**
- **Store points in CampHawk's database.**
  - Add `latitude`/`longitude` to `campsites`.
  - Fill them in the existing RIDB sync.
  - Background layers cached per campground, as a JSON or GeoJSON blob in R2 or Supabase
    Storage.
- **Don't bundle 3,600 × 45 KB into the app.** Load a campground's map JSON on its page.
- **Source order per layer:** NPS or USFS (federal) → OSM (ODbL, credited) → nothing. The map
  renders whatever exists.
- **Automated QA before a map goes live:**
  - % of sites placed.
  - Duplicate or stacked points (some RIDB campgrounds put every site on one spot).
  - Points far from any road.
  - Points outside the OSM campground outline.
  - A failing campground stays in the "not drawn yet" state. **A wrong map is worse than no
    map**: someone drives to the wrong loop.
- **Human review:** a lab page listing new maps with their QA numbers, approved in batches.
- **Hosting check:** Vercel's Hobby plan is non-commercial. Confirm which plan camphawk.app is on
  before adding traffic.

## Tools, skills and connectors (free)

| Need | Tool | Cost / terms |
|---|---|---|
| Data processing | Node (the build script), GDAL/`ogr2ogr`, `osmium` for Geofabrik OSM extracts | Free, open source |
| Editing / tracing geometry | QGIS (desktop), JOSM or iD (OSM), geojson.io | Free |
| Imagery to trace | USDA NAIP, USGS National Map | Public domain. **Not** Google (terms forbid tracing), and **not** Esri or Bing outside OSM |
| Terrain (hilly campgrounds) | USGS 3DEP elevation + `gdaldem hillshade` | Public domain. Upper Pines' tile showed a seam where 1 m lidar meets coarser data; needs smoothing before use |
| Rendering | SVG from JSON (what the lab does). MapLibre GL + PMTiles only if we want a zoomable map later | BSD/MIT, $0 |
| Tile/blob hosting | Cloudflare R2 (connected to this session) | 10 GB and egress free |
| Database | Supabase (connected) or CampHawk's existing Postgres | Free tier |
| Symbols | NPS map symbols | Public domain |
| Design | Our design skills; Inkscape for symbol drawing | Figma's free tier is 3 files; Felt's free plan bans business use |
| Skills | `design-direction`, `camphawk-design` (binds the look), `ui-audit`; the `campground-maps` skill (written 2026-10-08; loads the playbook) | — |
| MCP | OSM/Overpass MCP servers exist (MIT), but they hit the public Overpass servers, which discourage production use and were unreachable from this container. Use Geofabrik extracts | — |

## The mockup: what it shows

**Upper Pines.** Sites, roads, restrooms, kiosk, parking, shuttle stop, trails and the river all
come from public data.

**The calendar and the map work together:**
- Pick a night, and its open sites become green tick pins with their numbers.
- Tap one for its facts and the Book hand-off. A single open site opens on its own.
- The day panel's **Map** button jumps to the site on the map.

**The rules it follows:**
- **No state by colour alone.** Open is a pin, a tick and a number; everything else is a plain dot.
- **Water is never blue,** because blue means the hand-off to a provider in CampHawk.
- **Only open sites are buttons.** The day panel stays the list.
- **Distances are said to be straight lines.**
- **Site numbers are thinned** to what fits at the current width.

**Lab data changes:** the seven example sites now have RIDB's real types. The lab had invented
"Loop A, tent only"; Upper Pines has no named loops in RIDB.

## Review rounds (separate critic agent, against an NPS park map)
- **Round 1: 5.5/10.** No way to find a given site on a phone, service symbols too heavy, Book
  far from the pin, weak roads, text "▲N". All addressed: Find a site, zoom (the map drawn
  1600px wide in a pannable frame), numbers beside their dots away from the road, outline
  symbols, Book straight under the map, a real north arrow, a scale that follows the zoom.
- **Round 2: 7/10, "fix then ship".** It found numbers sitting between two dots, which can name
  the wrong site. Fixed after the round: a number is placed only where every other dot is at
  least 6px farther than its own (tested; mutation-checked). Also fixed: footprints showing
  under restroom symbols, symbols under pins, symbols cut off at the edge.
- **Still open (not done, on purpose or for time):**
  - The frame isn't fitted tightly. About 30% of the desktop map is river and trail with no
    sites.
  - The river is a stair-stepped USGS polygon, and roads show facets when zoomed. They need
    smoothing in the build.
  - Unzoomed on a phone only a few numbers fit. The zoom button says "Zoom in for site
    numbers".
  - About a quarter of sites have no number even zoomed. Find a site reaches all of them.
  - No hillshade or tree texture: the valley floor is flat, we have no canopy data, and the
    elevation tile has a seam.

## Open questions for the owner
1. Recreation.gov first, then RC? (Recommended; reasons above.)
2. May we email geodata@parks.ca.gov as CampHawk?
3. For RC without State Parks data: trace from aerial photos (our own, approximate), contribute
   to OSM, or wait?
4. Is a straight-line "restroom about 90 ft" helpful, or would you rather have nothing than an
   approximation?

## The 50-campground sample (Recreation.gov, 2026-10-07)

**The question:** how many Recreation.gov campground maps can go live without a person, and what
stops the rest? Build: `studio/campground-maps/` (README has the commands). Review page:
`/private/camphawk/golden-hour/admin/site-maps`.

### How it was drawn
- **Population** (RIDB export of 2026-10-06): campgrounds that are reservable and enabled,
  counting overnight sites that aren't staff sites, with a point for at least 90% of them. That
  is **3,212**. The earlier "3,623" counted day-use sites too, so 411 of those were picnic and
  shelter facilities with no overnight site.
- **1,016 of the 3,212 are a single unit** (a cabin, a fire lookout, a guard station, one group
  site). They hold 1% of the sites and need a location, not a site map. They are counted, not
  sampled.
- **The sample is 50 of the other 2,196**, stratified by agency (Forest Service 30, Army Corps 12,
  Park Service 6, BLM 2) and random within each (seed 20261007; `sample.mjs` re-draws it exactly).
- **Changed once, and said so:** the first draw took all 3,212, and 17 of its 50 were single
  units. The rule was changed to two or more sites before any map was built.

### How each map was checked
- **The automatic check (`qa.mjs`)** has seven checks: sites with a point, stacked points,
  outliers, spread, distance to the drawn roads, inside OpenStreetMap's campground outline, and
  agreement with OSM's numbered pitches.
  - **The thresholds were fixed before the sample was built**, from Upper Pines (measured: sites a
    median 14 m from the Park Service's roads, worst 19 m) and State Parks' 1-9 m.
  - Tested, 19 of 19 mutants killed (six only after the tests were fixed).
- **A first look:** every map over the USDA aerial photo (NAIP, public domain), drawn by
  `aerial-check.mjs` and judged by eye. It gives one of four calls: good, usable (sites right, some
  roads missing), not usable as drawn, or can't tell.
  - It is one look at 0.6-1 m imagery. Under trees a pad can't be seen, so "good" there means
    nothing looked wrong.
  - The calls are in `src/lab/camphawk/round2/maps/sample-review.ts`, and shown on the review page
    apart from the owner's own decisions.

### What it found
| The check said | Good | Usable, roads incomplete | Not usable as drawn | Can't tell |
|---|---|---|---|---|
| Ready (32) | 18 | 12 | 0 | 2 |
| Needs a look (18) | 6 | 0 | 12 | 0 |

- **Ready on its own: 32 of 50 (64%).** Across the 2,196, that is 50-76% (Wilson 95%), about
  1,100 to 1,670 maps.
- **No map the check passed looked unusable.** The check never let a map through that would send
  someone to the wrong loop.
  - **But 12 of the 32 it passed are missing some campground roads** (a spur, the inner lanes).
    Their sites are right, so they're usable, not polished.
  - The check measures how far sites are from the roads that ARE drawn. It can't see a road that
    is missing when another road passes close.
- **6 of the 18 it held were fine:**
  - three were held only for one site with no point;
  - Cottonwood Group and Antietam Creek are walk-in sites, legitimately far from a road;
  - White Rock's cabins sit outside OSM's campground outline, as cabins should.
- **After one look: 38 of 50 (76%; 63-86%) can go live.**
- **The 12 that can't, and why:**
  - **9 are missing campground roads:** Yellowbottom, Twin Peaks, Cave Creek, Dog Creek, Murrell,
    Covered Bridge, Salt Springs, Pringle Falls, Edna Creek.
  - **3 aren't one campground:** Rabbit Valley spreads over 8 km, Medicine Lake is several
    campgrounds under one listing, and Pioneer Trail's three group sites span 770 m.
- **RIDB's site points were right wherever the pads could be seen.** Not one point was seen off
  its pad. The weak layer is roads, not sites.
- **Where the layers came from:**
  - Roads: OpenStreetMap 43, Park Service 6, none 1 (Rabbit Valley, too spread to fetch). Forest
    Service system roads were never needed.
  - Water: USGS 11, OpenStreetMap 38, none 1. **USGS's hydrography service timed out for hours that
    day**, so most maps fell back to OSM's lakes and rivers. Each map records its source.
  - No build failed.

### The owner's review of the sample (2026-10-08)

The owner approved all 18 maps the first look found usable (12 with traced roads, 6 flagged by the
check but fine on the photo) and kept the other 5 hidden. So **45 of 50 maps are publishable** and
5 show "not drawn yet". This was one review of a session's first look, grouped and linked; review
time per map was not measured. Recorded in `src/lab/camphawk/round2/maps/decisions/wave-00.json`.

### What would raise it (owner's call)
1. ~~**Pick the road source by fit, not by agency.**~~ **Built the same night**, with two more
   sources than first measured (Forest Service and Census roads); it helped 4 maps on its own,
   not 1. See "Roads: picked by fit, then traced".
2. **Trace the missing loops from NAIP.** ~~Into OpenStreetMap~~ **Built as our own trace files
   instead** (same section): a person draws them on the review page and the build adds them.
   Putting them into OpenStreetMap as well would fix everyone's maps; that needs the owner's own
   OSM account (no automated edits), and is still open.
3. **Draw the camper's map over the aerial photo** instead of a road layer. This fills every road
   gap at once, but it changes the look, the photos can be a few years old, and pages get heavier. It is a
   design decision, not a fix.
4. **Split multi-campground listings** (Medicine Lake) into one map per cluster, and show
   dispersed areas (Rabbit Valley) as a list of areas, not one map.
5. **Single units** (1,016) get a pin on a small area map, not a site map.

### Not measured
- How long a person takes per map.
- Whether OSM is better or worse in the rest of the country than in this sample.
- Positions under dense canopy (the photo can't show them).
- The sample doesn't touch ReserveCalifornia, whose route is State Parks' layer, above.

## Roads: picked by fit, then traced (2026-10-07, night)

The sample showed the gap is roads, not sites. Two fixes, both built and tested.

### 1. Pick the road source by fit (`studio/campground-maps/roads.mjs`)
- **Four sources, one per map** (two sources' copies of one road would draw it twice):
  - the Park Service's GIS;
  - OpenStreetMap;
  - the Forest Service's system roads (`EDW_RoadBasic_01`);
  - the Census Bureau's TIGER roads (`tigerweb.geo.census.gov`, public domain), new.
- **The rule:** measure every site's distance to each source's roads and take the source with the
  shortest "9 in 10 sites within" (p90) distance. A missing loop is exactly what moves that number.
  The usual order (Park Service, OpenStreetMap, Forest Service, Census) still wins when its p90 is
  within 5 m or a quarter of the best, whichever is larger.
- **The margin was set after measuring the sample, not before** (unlike the QA thresholds), so it
  is fitted to these 50. Tested on the sample's own cases (`scripts/campground-maps-roads.test.mts`,
  8 of 8 mutants killed).
- **What it changed:** 10 of 50 maps took a different source. Twin Peaks went from the Park Service
  to OpenStreetMap. Three went to Census roads (Cave Creek, Dog Creek, Udall Park), and six to the
  Forest Service (Covered Bridge, Salt Springs, Colorado, Dennis Cove, Blue Lake Creek, Edna Creek).
  - **Ready on its own went from 32 to 36.** Twin Peaks, Dog Creek, Covered Bridge and Edna Creek
    now pass.
  - **Each change was checked over the photo:**
    - better and right: Twin Peaks, Dog Creek, Edna Creek, Colorado;
    - better, still missing lanes (then traced): Cave Creek, Salt Springs, Udall Park;
    - can't confirm under canopy: Covered Bridge, Blue Lake Creek, and Dennis Cove, whose Forest
      Service loop runs exactly through the site points, as if one was drawn from the other.
- The review page shows each map's fits for all four sources and why the one used won.

### 2. Trace what no source has (`studio/campground-maps/trace.mjs`, the review page)
- **The file:** `studio/campground-maps/traces/ridb-<id>.json`, roads and points in degrees, so it
  survives a rebuild. The build checks it and stops on a bad one.
  - A road can be named and marked a through road.
  - `replace: true` makes the trace the map's only roads. That's for a map whose source has the
    roads but draws them in the wrong places (Lost Creek: up to 20 m off).
  - Points are restrooms and water taps.
- **The photo is USDA NAIP (public domain)**, so what is traced from it is our own work, with
  nothing to license. Credits say "traced by CampHawk from USDA aerial photos".
- **A traced map always waits for a person:** the automatic check has an eighth check, "Traced from
  the aerial photo", which holds any map with traces for approval, however well its sites fit.
- **The tool** ("Trace what's missing", on each map's page):
  - draw roads, restrooms and water taps over the photo at 1×, 2× or 4×;
  - snaps to a nearby road, so a new lane joins the one it leaves (the join is ringed);
  - works by keyboard (arrows move a cross, Enter places a point, Escape finishes);
  - Finish road and Undo stay in reach at the bottom of the screen while a road is being drawn;
  - each road is numbered on the photo, matching the list, and a row you point at haloes its road;
  - a road can be named, marked a through road, or continued later (under Edit);
  - "Replace the source's roads" asks first, then says the source's roads are hidden;
  - a deleted road or point can be brought back until the next change;
  - saved in the browser. The camper's map preview shows the traces at once. The page and the
    queue say the traces aren't built yet, and Approve becomes "Approve without my traces";
  - "Download trace file" gives the exact file the build reads. It goes on the map when a session
    adds it to `traces/` and rebuilds (lab: there is no server to save to).
- **Review:**
  - a UI audit (Vercel's guidelines plus the house rules) found three must-fixes: taps on phones,
    an undo for deletes, and road numbers on the photo. All were fixed.
  - a separate critic agent scored it 6.5, then 8/10, with every must-fix and should-fix of
    both rounds made.
  - Not checked on a real phone: whether, at 2× and 4×, the sticky road bar covers points you
    want to place at the bottom of the visible photo. (Scrolling the page clears it.)
- **Tested:**
  - lab arithmetic and file round trip (`src/lab/camphawk/round2/maps/trace.test.mts`, cross-checked
    against the builder's own projection);
  - the build's file check (`scripts/campground-maps-trace.test.mts`, all mutants killed);
  - two browser checks. They cover: mouse, keyboard and point positions; reload, the preview and
    the queue tag; continue and undo; replace-confirm; download validated by the build's own
    check; delete and undo-delete; the phone zoom; and a built-in trace.
  - Mutation round on the browser checks: 8 of 8 killed. One was killed only after a
    point-position check was added, and one was the duplicated-badge bug, put back on purpose.

### What a session traced, and what it didn't
- **Traced, 13 maps:** Udall Park, Cave Creek, Salt Springs, Pringle Falls, Preston Bend,
  Trimmer, Six Mile, Lost Creek (whole road layer replaced), Murray Bay, Buck Hall, Lower Little
  Truckee, Rio de las Vacas and Murrell Park.
  - **Only what could be seen was traced.** Each was checked over the photo after rebuilding, and a
    trace that sat off the visible road was moved.
  - Every trace file has a note saying what was left out and why.
- **Left alone:**
  - Yellowbottom and Hearts Content are under full canopy.
  - Ward Mountain's and Dog Creek's missing pieces are short spurs that can't be made out.
  - Crystal Creek's drawn spur is within a few metres of its track.
- **No restrooms or water taps were traced by the session.** A building on the photo can't be
  told from a shed with confidence. The tool lets a person place them.

### The result
- **After one look: 45 of 50 (90%; 79–96% across all 2,196), up from 38.**
  - 32 good, 10 usable with some lanes still missing, 3 that passed but can't be confirmed under
    canopy.
  - Of the 23 the check holds, 18 are usable on the photo: 12 with roads traced from it, and 6 held
    for other reasons (one site with no point, walk-in sites).
- **Ready on its own: 27 (40–67%).** That is lower than before on purpose: 12 of the maps that would
  pass now wait only for someone to approve their traced roads.
- **The five left:**
  - Rabbit Valley, Medicine Lake and Pioneer Trail aren't one campground (option 4 above);
  - Yellowbottom is under full canopy, and only one short lane shows;
  - Murrell Park: no lanes to its sites are visible, though Recreation.gov allows a 20 ft vehicle
    at each.
- **Not measured:** how long a person takes with the tool. A session traced and checked the 13
  maps in about three hours, but that includes building the checking aids, and it was done from
  coordinates on a grid, not with the tool.

### Restrooms and water: what the agencies publish
- **The Forest Service publishes text only, not locations.** `EDW_RecInfraRecreationSites_02` has
  one point per site, with `restroom_availability` ("Vault toilet(s)") and `water_availability`
  ("drinking water is available from faucets").
- So locations come from the Park Service (its own parks), OpenStreetMap or a person's trace. In
  the sample, 20 of 50 maps have a restroom and 7 a water tap.
- **Not built:** saying "Vault toilets; water from faucets (locations not mapped)" from that text,
  where the map has none.

## The map review screen (lab mock of CampHawk's admin, 2026-10-07)

`/private/camphawk/golden-hour/admin/site-maps`. Built with `design-direction`, gates 1, 3, 5
and 6. Gate 2's references are CampHawk's own admin (AdminShell, Books), because the look is fixed
and this is one more section of it. There are no alternative directions to offer.

**Brief.**
1. *Subject and audience:* the owner (or, later, a helper) at a desk or on a phone, deciding
   whether a map CampHawk drew is right before a camper relies on it to find a site. Daylight
   work, so light. That is CampHawk's only theme anyway.
2. *Mode:* Operate. Clarity first; the brand lives in the admin shell, the type and the map.
3. *The one job:* say which maps can go live, and make the ones that need a person quick to judge.
   It works if a reviewer can clear a "Needs a look" map in under a minute with the aerial photo.
4. *Fixed:* CampHawk's admin language (forest sidebar, `PageHeader`, `Panel`, `StatusMark`:
   shape and word, never colour alone), its tokens and its copy rules (`camphawk-design`).
5. *Free:* the thumbnail drawing, the reasons summary, the detail layout, how the aerial check
   reads.

**Direction contract.**
- *Thesis:* the evidence is the interface. Every verdict carries its reason in words, and every
  map can be held up against the ground. It refuses the category default, a table of green and
  red dots.
- *World:* paper page, white panels, forest sidebar. Status uses the house marks: Ready is a round
  tick, Needs a look a triangle, Can't be drawn a round cross. Each mark carries its word, and its
  colour comes last. Thumbnails are drawn in ink on shell (roads as white strokes with a muted
  casing, sites as ink dots, water in `ch-map-water`), the same drawing as the camper's map.
- *First viewport (1440):*
  ```
  [forest sidebar | Site maps (title, 26px)                                   ]
  [  Overview     | 50 Recreation.gov campgrounds, drawn at random…            ]
  [  …            | [forest KPI: N of 50 ready on their own] [Needs a look] [Can't] ]
  [  Site maps ▌  | [Why maps need a look: reason bars]                        ]
  [               | [All · Ready · Needs a look · Can't be drawn]  filter pills ]
  [               | [card][card][card][card]  thumbnail, name, mark+word, reason ]
  ```
  At 390 the sidebar becomes the slim forest header with a tab row, and the cards stack one per row.
- *Signature moment:* the aerial check. In a map's detail the same frame is shown over the USDA
  aerial photo (NAIP, public domain), with sites and roads drawn on top, so "is site 42 on a real
  pad?" is answered by looking.
- *Assets:* none generated. The maps are code (real data); the photo is NAIP, loaded live from
  USGS, never committed.

**Critic rounds** (a separate agent, against CampHawk's admin and the best triage tools):
- **Round 1: 6/10, "fix then ship".** The findings:
  - Approve stayed the primary button even where the first look said "not usable".
  - The decision scrolled away behind the photo.
  - The photo was shrunk, with dead space around it.
  - The cards sat under two summary panels.
  - Thumbnail water had hard edges.
  - The checks hid their result on phones.
  - All fixed in one batch:
    - the firm button follows the evidence, with a third outcome, "Needs roads added";
    - a sticky rail holds the first look, the failing check and the decision;
    - the photo fills the column, with thin site rings and a strength slider;
    - cards come first, and quick approvals lead the queue;
    - water is clipped to the frame, and phones get a stacked checks list.
- **Round 2: 7/10, "ship after small fixes".** Its fixes were made after the round: failing checks
  sort first, one label style, the headline tile split into lines, thinner rings, the failing
  check in the rail, a visible slider value.
- **Still below Linear and Mapbox Studio, by its own account,** on keyboard flow and on zooming into
  the photo. Single-key shortcuts were left out on purpose: WCAG 2.1.4 needs a way to turn them off.
- **A UI audit (`ui-audit`) found three items, all fixed:** 40px controls raised to 44px, heading
  levels in the summary, and the photo's size attributes.

## Wave 1: the 100 most-wanted Recreation.gov campgrounds (2026-10-08)

**Wave 1 is 100 campgrounds chosen by demand, not at random,** so its shares describe these 100
and do not estimate the 2,045 still to draw. Built from the RIDB export of 2026-10-07 (the
population rule gave the same 3,212 / 1,016 / 2,196 as the 10-06 export). Review it at
`/private/camphawk/golden-hour/admin/site-maps?wave=1`.

### What went in
- **16 campgrounds a CampHawk user has watched.** That's all of them in the 2,196 that weren't
  already built. (An earlier count said 17; corrected.) **Which 16 is not recorded anywhere in
  this repository**: the wave's spec and manifest hold no reason per campground and aren't in
  the plan's order (`committedPicks`), because the repository is public and the watched list can
  point to a person (playbook §4.2).
- **84 most-reserved, by agency share of what's left:** Recreation.gov's FY2025 overnight
  camping reservations per facility (`reservations2025.zip`, 487 MB, from the RIDB downloads
  page; only `facilityid` was kept, never a customer column).
- By agency: Forest Service 59, Army Corps 23, Park Service 14, BLM 4.
- They are big, busy campgrounds: Mather (48,193 reservations a year), Watchman, Gros Ventre,
  Colter Bay, Jumbo Rocks.

### How it was built
- **OpenStreetMap came from regional extracts** (OpenStreetMap France, 2026-10-07), not the
  API. Measured:
  - 102 boxes were cut in one pass per extract in 363 s.
  - **On 13 maps compared, the extract and the API gave the same features.**
  - Downloads ran 0.25 to about 30 MB/s; `us-northeast` (2.0 GB) took about 40 minutes.
- **Roads by fit:** OpenStreetMap 80, Park Service 13, Forest Service 5, Census 1, none 1.
- **Water:** USGS 99, none 1. USGS answered all day this time.
- **No build failed.** Eight first waited for their region's extract, then built.

### The automatic check against the first look over the photo
Every map was looked at over the aerial photo; wide frames were zoomed on a gridded view
(`aerial-grid.mjs`).

| The check said | Good | Usable, roads incomplete | Not usable as drawn | Can't tell |
|---|---|---|---|---|
| Ready (48) | 34 | 10 | 2 | 2 |
| Needs a look (52) | 15 | 16 | 18 | 3 |

- **Usable after one look: 75 of 100 (95% interval 66-82%).** That counts the maps whose traces
  wait for approval. **That is below the sample's 79-96%, and outside it.** The playbook says to
  stop and ask the owner when that happens (§5).
- **By agency:**
  - Park Service: 14 of 14;
  - BLM: 4 of 4;
  - Forest Service: 46 of 59 (78%);
  - **Army Corps: 11 of 23 (48%; 29-67%).** Corps parks are large lake campgrounds spread over
    peninsulas, and OpenStreetMap often has only their entrance road.
- **The watched 16: all usable** (11 good, 5 usable).
- **The check passed 4 maps the photo doesn't support.** The sample had none. Two are held:
  - Cave Spring: two of its six loops have no road. The check reads the median distance to a
    road, and two thirds of the sites are near one.
  - Bloomington East: four areas over 1.4 km, numbers overlapping.
  - Wheeler Gorge and Cagle are "can't tell", because their sites sit off the drawn roads
    under canopy.
- **Why the 20 are held:**
  - **10 aren't one campground's map:** Diamond Lake, Lost Lake, Dinkey Creek, Au Sable River,
    North Bend, Holiday, Seven Points, Ives Run, Bloomington East, Dam Site. They wait for the
    split-listing design the owner approved for after wave 1.
  - **9 are missing roads the photo can't supply under canopy:** Cave Spring, Hume Lake,
    Rancheria, Twin Lakes (SC), Kendall, Canal, Gunter Hill, Baileys Point, Piney Grove.
  - **1 has repeated site numbers:** La Wis Wis (several loops each have a 005, 010, 015).
- **New failure shapes, not seen in the sample:**
  - repeated site numbers;
  - walk-in loops reached by footpaths (Watchman's F loop), which aren't roads to trace;
  - dispersed river sites over 35 km (Au Sable);
  - a facility with the wrong state in RIDB (Hardin Ridge, Indiana, listed under Maine; shown
    as published).
- **RIDB's points held up again.** No point was seen off its pad where the pads show. The gap is
  still roads, and now also split listings.

### Traced
- **9 maps were traced from the photo:** Moraine Park, Floating Mill, Sycamore Grove, Red Rock
  Canyon, Indian Boundary, Heaton Bay, Defeated Creek, Gunter Hill and Baileys Point.
- Every trace was checked over the photo after the rebuild, and each file's note says what was
  left out.
- Gunter Hill and Baileys Point stay held: only their open halves could be traced.
- **Looked for and not traced:**
  - Oh Be Joyful: the only track is across the river.
  - Watchman F: footpaths, not roads.
  - Juniper Springs: the track leads elsewhere.
  - Canal, Gun Creek and Dam West: the lanes don't show.
- **Still worth a person's trace on the review page:** White Oak (lane past 073 to 083), Hume
  Lake and Piney Grove (lanes show in places).

### Also found and fixed while building it
- **Service points were dropped by name.** The Park Service types its taps "Potable Water" and
  its toilets "Toilet". `pois.mjs` now maps every published type to the names the map draws.
  19 maps were rebuilt, including Upper Pines, where a stray "Campground" point became its
  water tap.
- **Tall frames had no photo.** USGS serves at most 4,000 px a side and answers a bigger ask
  with a JSON error under an image header. `naip.ts` scales the request.
- **The review page offered "Keep it hidden — not one campground" for maps held over missing
  roads.** The first offer now follows what held the map (`suggestedDecision`).

**The owner decided wave 1 the same day:** groups A and B approved (31), C and D hidden (25),
recorded in `maps/decisions/wave-01.json`.

## Wave 2: the next 100 by reservations (2026-10-08)

Built from the same export. **Nobody new is watched** (the 23 Recreation.gov campgrounds watched on
CampHawk are the same as for wave 1), so all 100 are the most-reserved of each agency: Forest Service
60, Army Corps 25, Park Service 12, BLM 3. Like wave 1, they were picked by demand, not at random.

- **Built:** 100, no failures. Russian River (Alaska) was read from the OSM API, since no extract
  covers Alaska.
- **Roads by fit:** OpenStreetMap 72, Forest Service 12, Park Service 8, Census 7, none 1.

| The check said | Good | Usable, roads incomplete | Not usable as drawn | Can't tell |
|---|---|---|---|---|
| Ready (51) | 20 | 18 | 12 | 1 |
| Needs a look (48) | 10 | 15 | 21 | 2 |
| Can't be drawn (1) | 0 | 0 | 1 | 0 |

- **Usable after one look: 61 of 100 (51–70%).** Lower than wave 1 (75) and the sample (90).
- **By agency:**
  - Forest Service: 40 of 60;
  - Park Service: 9 of 12;
  - BLM: 3 of 3;
  - **Army Corps: 9 of 25 (20–55%)**, again the weak group.
- **The check passed 13 maps the photo doesn't support** (wave 1: 4). Most are Army Corps lake
  campgrounds of 1.0–1.5 km whose areas sit on separate points of a lake. They fit the check's
  1.5 km spread limit, and the numbers still overlap.
- **Why 36 are held:**
  - **19 are split listings** (several areas apart). This is the biggest single reason, so the
    area design (below) matters most.
  - The rest are missing roads under canopy.
  - One, Clear Springs (TX), has a single site that RIDB places 2,300 km away, in California.
    The other 100 sites are in one place; a build rule to drop such a point is not written yet.
- **Traced:** Cochiti's west loop and Tule's north lanes, both checked over the photo.
  - Manzanita and John F Kennedy were zoomed: no lane shows.
  - Still worth a person's trace: Bakers Hole, Barton Flats, Seneca Shadows, French Camp,
    North Campground (UT), Eastbank, Axtel.
- **New:**
  - Russian River (AK) has no NAIP photo (NAIP doesn't cover Alaska), so the call is "can't tell".
  - Camp 4 (Yosemite) is walk-in, so it has no campground roads by design.

### Split listings and single units: designed (lab comps)
Contract, critique and measurements: `docs/design/campground-maps-areas.md`. Comps:
`/private/camphawk/golden-hour/admin/site-maps/layouts`.

**The owner's calls (2026-10-08):** pass A and B (23 approved: 2 traced, 21 flagged but fine on the
photo), hold C and D (39 hidden). Recorded in `maps/decisions/wave-02.json`.

## Areas built in: split listings and single units (2026-10-08)
**The owner picked split A (overview, then one area at a time) and single A (map and facts side by
side, with terrain).** Built into the build, the check and the review page (playbook §1, §5.1,
§5.2).

**Which listings are areas** (`build.mjs` `viewOf`, `splits.json`):
- **27 listings rebuilt as areas:**
  - 21 called split by the first look (waves 1 and 2);
  - 6 spread over 1.5 km, or called split and over it anyway;
  - 1 from the sample (Medicine Lake).
- 2 are dispersed and stay held: Au Sable (73 groups) and Rabbit Valley (14).
- 3 are kept as one map by a call:
  - Strawberry Bay and Gros Ventre, which the owner approved as one map;
  - Clear Springs, whose spread is a stray point 2,300 km away. The fix there is dropping the
    point, which is not written yet.
- Not added:
  - Axtel and Moutardier were called "partly" split, but their loops fit in one 1 km area, so a
    call would change nothing.
  - Clear Creek can't be drawn at all (26% of its sites share a spot), so it records no areas.

**The check, per area:** every split waits for a person (`areas`). In waves 1 and 2, wave 2's
summary went from 51 to 45 "ready": six maps that passed every check as one map now wait as areas.
The owner had held all six.

**The first look over the areas' overviews** (every listing, screenshotted):
- **Found and fixed:** an area at the listing's edge lost its outline and number to the frame
  (Medicine Lake, Hardin Ridge, Airport Park, Bolar Mountain, Ives Run). The overview now makes
  room for both.
- **Split fixes it (14):** the areas follow the real clusters, and the hold was the split alone (or
  an area check the photo already answered).
  - Medicine Lake 255303 (sample)
  - Dinkey Creek 232136
  - Ives Run 233523
  - North Bend Park 233563
  - Seven Points 233626
  - Wawona 232446
  - Indian Cove 232472
  - Airport Park 232511
  - Cedar Ridge 232546
  - Forrest W. Bo Wood 233496
  - South Marcum 233611
  - Shenango 233627
  - Outlet (Melvern) 233695
  - Bolar Mountain 234557
- **Split right, but an area still lacks roads or is flagged (6):**
  - Holiday 232607: the south-west cluster has no roads.
  - Bloomington East 233700: internal lanes.
  - Willow Bay 232127: the east cluster's lanes; its 052–102 area sits a median 47 m from roads.
  - Pine Valley 232244: the D loop's lane.
  - Ray Behrens 233597: the south area's lanes.
  - Assateague 232507: the oceanside area sits a median 33 m from roads, and none of its sites
    are inside OpenStreetMap's outline.
- **The split itself isn't right yet (7):**
  - **Coarse:** one area holds several clusters, because areas are cut at 1 km and these
    clusters sit closer than that. Dam Site 232567 (also lanes missing), Sweetwater 232715,
    Lithia Springs 233539, South Sandusky 233613, and Lost Lake 251434 (the F row and two H sites
    1 km apart in one area).
  - **Diamond Lake 231980:** five areas cut by position; the outlines still touch.
  - **Hardin Ridge 232056:** eight areas named by position because its site ranges interleave,
    one of them a 2-site area, and five areas sit far from roads.
- **Naming:** an area named by position says where along the listing's long axis it is ("West
  end", "Middle"). On a round lake that can read oddly (Bolar Mountain's "Middle" is south of its
  "West end").

**The owner's calls (2026-10-08):** approve the 14 the split fixes, keep the other 13 hidden.
Recorded in each wave's decisions file ("Approved as areas" / "Kept hidden as areas").

**Tighter areas (owner, same day):**
- **A loop now joins the area before it only when the two touch** (within the 200 m gap). Lost
  Lake's two H sites, 1 km down the lake, are their own area now; no other listing's areas changed
  (checked on all 250 maps).
- **A split call can set the cut,** read off the photo: `gap` (metres between clusters) or
  `maxSpan` (metres across one area):
  - Sweetwater: gap 150 m, so 3 areas;
  - Lithia Springs: gap 80 m, so 3;
  - South Sandusky: gap 120 m, so 4;
  - Dam Site: areas of at most 400 m, so 6 lettered areas.
- On the photo, each area now holds one cluster for Lost Lake, Sweetwater, Lithia Springs and
  South Sandusky. Dam Site's areas are right, but three of them still sit far from roads. All five
  stay hidden until the owner looks again.

**Single units:** the check and the location map are built. No wave has drawn one yet: the waves
by demand pick from the multi-site population. A unit wave is next (playbook §10).

## The parallel rollout (waves 3 to 39, from 2026-10-08)
Eleven child sessions, one batch of waves each (playbook §5.4); this session merges each batch,
makes the final check and records pass or hold (`decide-wave.mjs`). Each child's handoff is folded
in here.

| Batch | Waves | Maps | Passed | Held | Final check |
|---|---|---|---|---|---|
| northeast-api | 24, 39, 25, 33, 34 | 283 | 33 | 250 | 18 looked at over the photo (all 5 traces, all 3 splits, 10 sampled): agreed with all 18; `usable` re-read: 4 held |
| colorado | 22, 23, 35, 36 | 232 | 120 | 112 | 30 looked at (all 8 traces, all 5 splits, 17 sampled): agreed with all 30; `usable` re-read: 11 held |
| west-a | 3, 4, 5 | 283 | 169 | 114 | 31 looked at (all 13 traces, all 6 splits, 12 sampled): agreed with all 31; `usable` re-read: 7 held |
| west-units-b | 30, 31, 32 | 266 | 132 | 134 | 19 looked at (all 7 traces, 12 sampled): agreed with 17; held 2 the child passed (whole campgrounds booked as one "Standard" site) |
| west-b | 6, 7, 8 | 283 | 110 | 173 | 18 looked at (all 3 traces, both splits, 12 sampled, plus Packard Creek's stray point): agreed with all 18 at the time; `usable` re-read: 79 held, 6 of them maps I had agreed with |
| west-units-a | 26, 27, 28, 29 | 354 | 239 | 115 | 22 looked at (all 6 traces, 16 sampled): agreed with all 22 |
| south-b | 17, 18, 37 | 222 | 100 | 122 | 27 looked at over the photo (all 16 traces, both splits, 9 sampled), then every `usable` note re-read: 25 of 50 usable held (see below) |
| midwest | 19, 20, 21, 38 | 296 | 146 | 150 | 36 looked at (all 7 traces, all 17 splits, 12 sampled), then every `usable` note re-read: 47 of 112 usable held |
| south-a | 14, 15, 16 | 271 | 109 | 162 | 24 passing maps looked at over the photo (traced and split maps that pass, 9 sampled): agreed with all 24; the child called waves 15 and 16 under the corrected `usable` bar and re-called wave 14 |
| west-d | 12, 13 | 189 | 80 | 109 | 19 passing maps looked at over the photo (passing traces and splits, 10 sampled): agreed with all 19; the child called under the corrected `usable` bar |

**northeast-api (2026-10-08):**
- **Wave 24 (New England, New York, Pennsylvania):** 40 built. First look: 4 good, 20 usable,
  6 hold, 10 unsure (full summer canopy over many New England forest campgrounds).
  - Held: Tracy Ridge, Waterville (points around a treatment pond and a construction yard),
    Wildwood, East Branch, Bush, and Tompkins (lettered sites and Loop P with no lane).
  - 1 traced (Camp Gateway Sandy Hook). 3 split calls (Twin Lakes, Susquehannock with gap 150 m,
    Tompkins).
- **Wave 39 (northeast single units):** 23 built. First look: 10 good, 3 usable, 2 hold, 8 unsure.
  - The six Allegheny boat-in sites are under canopy (unsure). The "road within 700 m" check
    passes them on lakeside roads that don't reach them.
  - 4 drives traced.
- **Waves 25, 33, 34 (Alaska, Hawaii; OSM API): all 220 held.**
  - **USGS's NAIP service returns an all-black image for every Alaska frame and for both Hawaii
    listings** (measured on each pin: 87–88% black pixels).
  - So nothing there can be judged over a photo. These need another public-domain photo source,
    or the owner's call to pass on the map alone.
  - Four Alaska listings can't be drawn (every site on one spot). Joe T. Fallini (Nevada) spans
    4,974 km: its listing's points are wrong.

**colorado (2026-10-08):**
- **Waves 22 and 23 (Colorado, multi):** 126 built. First look: 59 good, 45 usable, 17 hold,
  5 unsure.
  - 6 traced. 5 split calls kept; 1 dropped because the area rules couldn't honour it.
  - **Census (TIGER) roads often come out as angular outlines that follow nothing**, as do a few
    OSM ones.
  - **A single RIDB point hundreds of km from the rest** (231864: 260 km; 232364: 870 km) makes the
    build show the listing as areas over a useless frame. Both held. The outlier rule should drop
    such a point; not built.
- **Waves 35 and 36 (Colorado, single units):** 106 built. First look: 23 good, 4 usable,
  77 hold, 2 unsure.
  - **New failure mode: 65 of the 106 "single units" are whole campgrounds booked as one
    "Standard" site** (Pike–San Isabel and San Juan). Their point is a placeholder on an entrance
    road or a junction, never on a pad.
  - The unit check passes them, so only the photo catches them. All held.
  - They need a population rule (one site named "Standard" is a campground, not a unit) and the
    campground's own map, or a "whole campground" design.

**west-a (2026-10-08, California, Nevada, Utah, Arizona, Oregon):** 283 built. First look: 82 good,
94 usable, 58 hold, 49 unsure.
- 13 traced, including Needles (Canyonlands), where every road was retraced because the source
  ran 10 to 20 m off. 6 split calls, each area holding one cluster on the photo.
- New: OSM's bubble-shaped loops (Lassen: Manzanita, Summit, Butte) are a recurring hold.
  Salmon Creek's site 033 sits 25 km away at a highway pull-off.
- Tall frames fail `aerial-grid.mjs` at the default 1,600 px width (USGS's 4,000 px limit); a
  1,200 px box works.

**west-units-b (2026-10-08, western single units):** 266 built. 7 traced (guard station drives,
group-site lanes).
- **Wave 32 is mostly not units:** 50 of its 89 listings are whole campgrounds with one
  "Standard" site.
- The child passed two of them. **The final check now holds every listing whose one site is named
  "Standard"** (`decide-wave.mjs`, tested), so the rule doesn't depend on each child's call.

**west-b (2026-10-08, us-west extract, multi-site):** 283 built. First
look: 61 good, 128 usable, 25 hold, 69 unsure (Pacific Northwest canopy).
- 3 traced (Lower Billy Creek, Chavez Crossing, Moose Creek Flat). 2 split calls: Swan Creek
  (two clusters 800 m apart) and Sand Flats Group C, which the build shows as dispersed groups of
  sites (the rule for clusters too spread to frame as areas). Big River's split failed the area
  test and was dropped.
- Packard Creek (232894): one site 4 km across the lake, shown as its own area; held, the same
  stray-point case as colorado's.
- USGS's water service failed for a few maps; the build fell back to OSM water as designed.

**west-units-a (2026-10-08, us-west extract, single units):** 354 built. First look: 195 good,
44 usable, 32 hold, 83 unsure.
- 6 traced, each the last stretch of road to a cabin or lookout, only where it was plain in the
  open.
- **Held units fall into two kinds.**
  - The unit's pin is off while the listing's own point sits on the building: Kentucky Camp,
    Fivemile Butte, Clear Lake, Whitetail, Deer Ridge, McCain and Trout Creek.
  - The pin is 60–130 m off a building that plainly shows: Grizzly Ridge, Fall River, Ludlum, La
    Barge and Gray Pine.
  - A rule that tries the listing's point when the pin sits on nothing could recover the first
    kind. It is not built.
- Wave 29 is a third group sites. Half of them are unsure, because a group site under trees shows
  nothing a photo can confirm.
- One full build exited without writing its manifest: a hung request left an unsettled top-level
  await. A re-run from the cache finished it.

**south-b and midwest (2026-10-08): some `usable` calls were maps that are wrong, not just incomplete.**
- The child's notes describe the photo accurately. But some maps it called `usable` have one of
  three faults:
  - a drawn road that doesn't follow the visible one;
  - misplaced or stacked sites;
  - a third or more of the sites with no drawn road at all (only the highway, or a whole row or
    loop missing).
- The owner's own wave 1 and 2 approvals set the bar. They pass maps whose sites and drawn roads
  are right with some spurs or lanes missing (232215, 232589, 233736), so missing spurs alone
  don't hold a map; the three faults above do.
- I read every `usable` note in waves 17 to 21 against that bar: 72 of 162 held (south-b 25 of
  50, midwest 47 of 112). Each held map carries the reason in its decision note.
- A stricter first pass (about 1 site in 7 with no road within 20 m) was dropped before merge,
- **The same re-read was applied to the batches already merged** (waves 3 to 8 and 22 to 24), so
  every batch is judged alike. It held 101 of their 287 `usable` maps:
  - west-a 7, colorado 11, northeast 4, and west-b 79;
  - west-b's waves 7 and 8 called nearly every forest campground with half its sites on undrawn
    spurs `usable`.
  - Six of the 101 are maps I had passed in west-b's final check (Camp Sherman, Crystal Springs,
    Eagle, College, Fawn Lakes, Rock Creek). I judged those against the looser reading, and they
    are corrected here.
  - The table's numbers are after the re-read.
  because it would have held maps the owner's own approvals pass.
- **The brief and the playbook now state the bar**, and the three children still running were
  told.
- **south-b (us-south):** 16 traced, 2 splits.
  - Pat Mayse East and Blue Ridge Park are now two areas each; Blue Ridge is still held, since
    neither area has a usable road.
  - **A relation crossing the extract's edge makes `osmium getid` exit 1** (Mill Run, 277 North).
    A retry built both from the cached answer; osm.mjs could accept the partial result.
  - Wave 37 (units): 27 pass, 14 unsure (canopy). The Cheoah Point cabins' listing point is 44 km
    from the unit's.
- **midwest (us-midwest):** 7 traced, 17 split calls.
  - Most splits follow the points of a lake, one area per point (Cottonwood Point 6, Mill Creek 6,
    Venango 5).
  - Held for the dispersed design: about 15 lake and island listings with sites 300 m to 50 km
    apart.
  - Two misplaced RIDB points: 233505 B19 is 33 km off, and 232720's A sites sit out in the lake.
  - River Run Park's photo was taken in a flood.
  - The child listed about 20 trace candidates (lanes plain on the photo) for the fix-after pass.

**south-a (2026-10-08, us-south extract, multi-site):** 271 built.
First look: 50 good, 59 usable, 127 hold, 35 unsure.
- 10 traced, 20 split calls.
- The highest hold share yet, and mostly not from canopy. In eastern Oklahoma, Arkansas and Texas,
  OSM often has the park road and area outlines but not the campground lanes, or draws the lanes
  beside the pavement.
  - Three listings draw area outlines as if they were roads: 233429, 233464, 234253.
  - About 25 holds have lanes plainly visible in the open and are trace candidates (several need a
    `replace` trace); they're listed in the handoff, kept in the branch history.
- New failure modes:
  - 10119481 has one site thousands of km away (a 6,000 km frame).
  - 273352 places its sites on an invented 10 m grid.
  - 232621 stacks sites two or three to a pad.
  - Three more listings have one site 14–28 km off (232655, 233703, 233658).
- The same OSM relation (r6265485) failed `osmium getid` in four builds across three batches.

**west-d (2026-10-08, us-west extract, multi-site):** 189 built. First look: 31 good, 49 usable,
67 hold, 42 unsure.
- 14 traced, 1 split call.
- **New, with a clear fix: "Extra Vehicle" twins.** BLM Salmon listings (10206584, 10206603,
  10206616, 10206646) list every site twice, "Site #N" and "Site #N Extra Vehicle" on one point,
  so they read as stacked and aren't drawn. Dropping the twins would likely make all four
  drawable.
- Forest Service roads were the commonest bad source in wave 13: rings drawn beside the visible
  loop (Lockaby, Bogus Creek, Clearwater Falls).
- One RIDB site is literally named "This site should be deleted" (233360).

### Running totals (Recreation.gov)
| | Maps built | Usable after one look | Decided by the owner |
|---|---|---|---|
| Sample (wave 0, random) | 50 | 45 | 50 (45 approved, 5 hidden) |
| Wave 1 (demand) | 100 | 75 | 56 (31 approved, 25 hidden) |
| Wave 2 (demand) | 100 | 61 | 62 (23 approved, 39 hidden) |
| **Total** | **250 of 2,196** | **181** | **168** |

Of the hidden, 27 are now shown as areas and wait on the owner again (above).
