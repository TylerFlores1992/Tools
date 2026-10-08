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
