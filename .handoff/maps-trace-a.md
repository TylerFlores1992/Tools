# Handoff: maps-trace-a (trace candidates, 28 held maps)

Branch wip/maps-trace-a. RIDB export 2026-10-07 (still the newest on 2026-10-08). Rebuilt with OSM_FROM=auto, MAPS_NO_INDEX=1. Traced from USDA NAIP only.

## Per map
- 232665: traced the east point's loops past 01-36, the access lane and day-use loop; still hold (37-58 under canopy, no road)
- 232684: not traced (42-57 under canopy, shore lanes too blurred to place); still hold
- 232662: traced the lanes past B13-B21, B29-B32, B35-B38 and east past B41; now usable (B23-B28, B05-B06 have no visible lane)
- 233650: traced loop B's lanes and rows (B04-B58), loop A's north lanes (A11-A24) and the access lane; still hold (A01-A10, A25-A32, B01-B03 under canopy: 25 of 90 sites without a road, near the bar)
- 232609: not traced (32-50 under canopy, 19 of 51 sites); still hold
- 232747: not traced (35-49, 84-88, 59-69 and 01-16 under canopy, lanes can't be placed); still hold
- 233457: replace trace of every visible road (lot lane, central lane, east loop, south loop and its rows, inner loop past 095-100); now usable (001-011, 044-053, 064-066 under trees, 22 of 101)
- 233508: traced every visible lane (replace: access, west lane and loop, east lane, inner lanes, shelter loop); now usable
- 234478: traced every visible lane (replace: shore road, main road, west loop ends, south lane, north and east loops, shore lane); now usable (west loop's middle past 015 to 019 under canopy, not drawn)
- 232698: not traced (west point's lanes past 55 to 91 under full pine canopy, a third of the sites; a replace trace can't cover them); still hold
- 232704: not traced (G and H under full canopy, the C and D lanes only in fragments: about half the sites can't get a road); still hold
- 233590: traced loops A and B (replace, keeping the source's main roads, C and D lanes); now usable (A04 to A10, A18 to A20, B30 to B33 under trees, no lane)
- 232634: not traced (south area 35 to 48 under full canopy, sites off the lane; can't be fixed by tracing); still hold
- 233678: traced the north arm past 003 to 027 and the west loop past 149 to 156 (replace, keeping the source's roads that fit); now usable
- 232663: not traced (18 of 38 sites under full canopy, no visible lanes); stays hold
- 232685: not traced (west loop lanes under pine canopy, photo too soft to place them); stays hold
- 233579: not traced (A interior, C01-C09 and B01-B12 sit on sand tracks that can't be placed, ~1/3 of 86 sites); stays hold
- 233589: traced the access road, main loop, lane past 20-23/49-53 and the east loop with its inner lane (replace); now usable
- 233641: not traced (lanes past 13-32 under full canopy, half the sites); stays hold
- 233667: traced the park road, the paved east loop, the west gravel lane past 07-16 and the lanes round 01-04 (replace); now usable
- 251574: traced the paved lane past 07-15, the entrance road and the lane to 02-03 (replace); now usable
- 233409: traced a replace (access, west lane, A, oval, B lane, E spine and lanes, F070/F072/F074 lanes, D north lane); now usable, C and D south left out under canopy
- 233790: no trace (horse lanes' links under trees, shore lane under pine canopy); still hold
- 233448: no trace (A's west lanes under canopy, B's sites on open grass without lanes; a trace would still leave over a third roadless); still hold
- 232623: traced a replace (Lillydale Rd, both herringbone lanes, east loop and its diagonal lane, 011-015 lane, south loop, north point ring); now usable, north point's link and 001/006 lane left out
- 234651: traced a replace (dam road, island ring, curve, cross road, lanes past 013-048, east shore road and loop past 009-012); now usable, 005-008 under trees
- 232714: no trace (west lanes and their link under canopy; east alone would still leave 01-16 roadless); still hold
- 232625: traced the lane east past 22-30 and the B lane past B11-B3; now usable, B1/B2 under canopy

## Totals
- 28 maps: 13 now `usable`, 15 still `hold`. None called `good`.
- 15 trace files written (`studio/campground-maps/traces/`): 13 on the usable maps; 232665 and 233650 are traced in part and still held (the traces are right, but too many sites stay roadless or the loops are unjoined).
- 13 held with no trace: full canopy over a third or more of the sites (232684, 232609, 232747, 232698, 232704, 232634, 232663, 232685, 233641, 233790, 232714), sand tracks that can't be placed (233579), split listing with roadless sites on open grass (233448).
- Sites more than 25 m from any drawn road, measured from the rebuilt maps (usable ones): 232662 15%, 233457 19%, 233508 9%, 234478 28%, 233590 18%, 233678 1%, 233589 26%, 233667 25% (5 of 20), 251574 7%, 233409 25%, 232623 5%, 234651 11%, 232625 7%. Held: 232665 39%, 233650 20%.

## For the final check
- 233650 (The Narrows) is a judgment call: 20-28% of sites roadless (under the bar), but neither loop's traced lanes join the access lane; held for that. Look again.
- 234478 (Jennings Ferry) at 28% roadless by distance is the closest usable to the bar.
- 233409 (North Fork): D's south arc past D035-D040 looks open on the whole-frame photo; the tracer left it out as canopy. Worth a zoom; tracing it would lift the map further.
- 232623 (Lillydale): the north point's ring road (101-115) is drawn but not joined to the main point (the link across the neck can't be seen).
- 233590 and 233678: replace traces that copy the source's roads unchanged where they already fit the photo; 233678 marks the public road through the site as `through`, unnamed.

## Anything new
- Tracing ran in four parallel worktrees; every trace was rebuilt again in this tree and every traced map's whole frame checked over the photo here. Frames didn't move on rebuild.
- USGS hydrography didn't answer for some builds; OSM water was used (recorded per map in `sources.water`). The NAIP photo answered every time.
- Tests: all pass except the index-sync test (expected until lab-index.mjs runs on merge).

STATUS: complete
