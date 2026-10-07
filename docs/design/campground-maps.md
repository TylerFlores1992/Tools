# Campground site maps: research, plan and first mockup

*2026-10-07. Lab only: nothing here changes camphawk.app. Mockup:
`/private/camphawk/golden-hour/campground` (Upper Pines; lab switch `?map=none` shows the
"not drawn yet" state, `?booking=first-come` the map without availability). Build tooling:
`studio/campground-maps/`.*

## The short answer

**We can draw our own maps, legally and for free, but each provider is a different project.**
Recreation.gov publishes real campsite coordinates under an open license, so it's the easy case
and should come first. ReserveCalifornia publishes **no** coordinates, only pixel spots on its own
map pictures, and California's campground GIS needs written permission for commercial use. RC
is the hard case: it needs a decision from the owner and an email to State Parks before any
drawing starts.

That reverses the requested order (RC, then Rec.gov). Here's why, with what was measured.

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
  - It has **no campsite layer**: 531 campground points (one per camp area), plus roads,
    trails and 3,246 buildings, including comfort stations.
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
| Skills | `design-direction`, `camphawk-design` (binds the look), `ui-audit`; write a new `campground-maps` skill once the pipeline settles | — |
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

## Open questions for the owner
1. Recreation.gov first, then RC? (Recommended; reasons above.)
2. May we email geodata@parks.ca.gov as CampHawk?
3. For RC without State Parks data: trace from aerial photos (our own, approximate), contribute
   to OSM, or wait?
4. Is a straight-line "restroom about 90 ft" helpful, or would you rather have nothing than an
   approximation?
