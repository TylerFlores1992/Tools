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
