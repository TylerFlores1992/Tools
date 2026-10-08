# Batch northeast-api

STATUS: started

Setup: RIDB full export dated 2026-10-07 (same as the specs). OpenStreetMap extract us-northeast from
download.openstreetmap.fr, OSM as of 2026-10-07T00:00:40Z (1.99 GB raw, 1.53 GB trimmed). Network:
every map host answered; tylerflores.dev timed out and Geofabrik reset (not needed). osmium-tool needed
`apt-get update` first.

## Wave 24 (us-northeast, multi)
- Built 40, failed 0
- Check: ready 21, review 19, not drawn 0
- First look: good 4, usable 20, hold 6, unsure 10
- Traced: 234714 (Camp Gateway Sandy Hook: the road northwest from the circle, lanes to the A, B and E sites)
- Split calls: 232128 (2 areas), 233644 (3 areas, gap 150), 233652 (2 areas)
- Held, and why (one line each):
  - 232126 Tracy Ridge: drawn loops don't match the sites (two loops hold none; rows of sites off any road, canopy)
  - 232179 Waterville: sites placed around a treatment pond and construction yard by condos; points wrong
  - 270967 Wildwood: drawn "roads" are straight-sided outline loops cutting across the sites, under canopy
  - 10122722 East Branch: the loop lane shows through leafless trees but isn't drawn; too faint to trace within 3 m
  - 272174 Bush: 023 to 043 sit on a web of visible lanes that isn't drawn; how they join the drawn roads is unclear, so not traced (a job for the review page's tracing tool)
  - 233652 Tompkins: lettered sites A to X and Loop P (across the bay) have no drawn lane
- Anything new: many New England forest campgrounds are under full summer canopy (10 unsure). USGS water
  didn't answer for two boxes; the build used OpenStreetMap's water.

## Wave 39 (us-northeast, units)
- Built 23, failed 0
- Check: ready 18, review 5, not drawn 0 (review: Hooks Brook has no road or trail within 700 m; four were traced)
- First look: good 10, usable 3, hold 2, unsure 8
- Traced: 234241 (Radeke Cabin driveway), 10004657 (Bay View House drive), 10290014 (Slyder Farmhouse lane), 10357061 (Rose Farmhouse drive)
- Split calls: none
- Held, and why (one line each):
  - 10004661 Le Count Beach House: pin on a bare sandy patch with no building; houses 50 m east and 100 m west
  - 10168556 Cottage at Sailors Haven: pin on open dune grass; the nearest roof is 35 m northwest
- Anything new: the six Allegheny boat-access sites (10165350 to 10165540) are boat-in under full canopy, so all are unsure; a "road within 700 m" check passes for them on lakeside roads that don't reach them.

## Wave 25 (Alaska, Hawaii; OSM API, multi)
- Built 30, failed 0 (OSM API answered for all 22 boxes outside the extracts on the first run)
- Check: ready 13, review 13, not drawn 4
- First look: good 0, usable 0, hold 5, unsure 25
- Traced: none (no photo to trace from)
- Split calls: none
- Held, and why (one line each):
  - 10156151 Joe T. Fallini: sites spread across a 4,974 km frame (Nevada and thousands of km east); the listing's points are wrong
  - 10325233 Cripple Creek, 10325252 Mount Prindle, 10325266 Ophir Creek: not drawn, every site on one spot
  - 10382456 Chilkoot Trail: not drawn, every camp shares a spot
- Anything new: USGS's NAIP service returns an all-black image for every Alaska frame AND for the two
  Hawaii listings (10119505, 234783), so nothing in this wave can be judged over a photo: all are unsure,
  with what the map itself shows in each note. These need another public-domain photo source, or the
  owner's call to pass them on the map alone. Six listings are cabin or permit lists spread over 6 to
  142 km (dispersed, no roads).

## Wave 33 (Alaska, OSM API, units)
- Built 95, failed 0
- Check: ready 53, review 42 (all 42: no drawn road or trail within 700 m, likely fly-in or boat-in cabins), not drawn 0
- First look: good 0, usable 0, hold 0, unsure 95
- Traced: none (no photo)
- Split calls: none
- Held: none
- Anything new: every unit is in Alaska and USGS's NAIP returns black for all 95 (zoomed on each pin;
  measured, not just eyeballed: 87 to 88% black pixels, the rest the grid). Each note states the build's
  own facts instead (distance from the listing's point, nearest drawn road or trail).
