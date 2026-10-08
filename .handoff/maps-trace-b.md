# Maps trace-b: trace candidates (35 maps)

RIDB export: 2026-10-07 (still the newest on 2026-10-08). Rebuilt with `OSM_FROM=auto MAPS_NO_INDEX=1`.
Network: every host answered (hydro.nationalmap.gov 504 at times; the builds fell back to OSM water as designed).
Every trace was checked over the NAIP photo after the rebuild and moved where it was more than about 3 m off.

## Per map
- 233425: still held, the C area's lanes are a dense web with many pull-ins and hidden joins, too big to retrace reliably from the grid (tracing tool).
- 233468: traced every road on the six points (replace; the source drew farm tracks); now usable.
- 233441: still held, A029 is a stray point 8 km away that holds it whatever is traced; lanes left for after the point is fixed.
- 232540: traced the lane past 37 to 48 and the south-east lanes past 15 to 24; still held, the west block (49 to 75) shows only as pad clearings under trees.
- 251160: still usable, untraced; the tracks inside the loops are narrow paths from a central building, too faint to place.
- 233547: traced every road in the three areas (replace; the source ran 30 to 60 m off); now usable.
- 233786: still held, the north loop and the lanes past 33 to 47 are under the trees, so the Census loops can't be replaced.
- 233419: traced the east lane and teardrop past 29, 35 to 37; still held, the north end is open dirt patches with no lane, and the south road is drawn 5 m off.
- 233427: traced the west lane past 01 to 07, the spur to 37 and the lane past 25 to 36 (east lanes unjoined, joins under trees); now usable.
- 233438: traced the A loop, B loop, F lane and road in (replace); now usable.
- 233832: traced the lane past 001 to 005 and the lane past 021, 022, 032, 033; now usable.
- 234647: no trace; the A shore sites sit on the open gravel apron the drawn loop runs down, no separate lane; now usable (note corrected).
- 156340: traced the spur to E13; still usable, E14 to E19 are under the trees.
- 10038827: no trace; the shore lane to 2 to 8 is under the canopy; still usable.
- 231842: traced the lane loop past 14, 15, 17; now good.
- 233850: still held, full canopy.
- 233141: still held, the lanes show only in gaps between conifers, so no full replace is possible.
- 254084: traced the lanes in the open south-east area (009, 013, 001); still usable (passed; the trace improves it).
- 10159225: traced the south shore lane past 9 and 10, the spur to 8 and the drive to 1; still usable.
- 10177518: traced the teardrop by 10 and 11, the lane past 5 and 6, and the ramp road; still held, 11 to 17 sit on open grass with no lane.
- 231907: still held, each loop is a web of about twenty pull-throughs, too dense to replace from the grid to 3 m (tracing tool).
- 249979: still held, the lanes break into fragments between oak crowns at tracing zoom.
- 233869: traced Loop A's open-ground lanes and Loop B's stem and loop; still held, about a third of the sites are under cottonwoods and the group sites have no road.
- 234115: traced every road (replace; full retrace of Boca Rest); now usable.
- 234540: traced the highway and the campground lane past 016 to 031 with its end loop; still held, 001 to 012 have no lane (under pines) and 033 is a stray 25 km away.
- 251616: still held, the visible loop past 20 to 26 joins the highway under trees, and 03 to 17 are under canopy.
- 272092: still held, the peninsula lanes are faint tracks under trees.
- 233895: no trace, the north-shore spurs show only in gaps; still usable.
- 10060948: still held, the lanes show only in pieces and their joins (to each other and to the highway) are under the firs.
- 251567: still held, open gravel flat with no lane line.
- 232311: no trace, the north loop breaks into patches between long tree shadows; still usable.
- 233835: traced the spurs to 010, 013, 017, 023, 025 and the lane past 019; still usable.
- 251894: still held, the middle is an open gravel area where the lanes can't be told apart for a replace trace.
- 266141: still held, the west loop shows only as fragments between pine shadows.
- 272174: still held, the south-east lanes are blurred and broken under the budding trees, joins unseen.

## Totals
- Traced: 19 maps (5 of them replace traces: 233468, 233547, 233438, 234115; plus the others adding roads). Replace: 233468, 233547, 233438, 234115.
- Not traced: 16 (canopy, open ground with no lanes, fragments, or too dense for the grid).
- Calls now: good 1 (231842), usable 16, hold 18. Moved from hold to usable: 233468, 233547, 233438, 234115.
- 233547, 233438 and 233141 were named for replace traces: 233547 and 233438 done; 233141 can't be (lanes under conifers).

## Anything new
- Several maps (Lucerne 231907, Berry Bend 233425, Bucksaw 233441) are traceable in principle but are dense webs better done with the review page's tracing tool, or after a stray point is fixed (Bucksaw A029).
- The first-look files keep numeric ids in file order; a JSON round-trip reorders them, so edit entries in place.
- Tests: all pass except the index-sync test (expected until the merge).

STATUS: complete
