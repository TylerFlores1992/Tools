# Batch west-c

## Setup
- Network: every map host answered (ridb, imagery.nationalmap.gov, hydro, tigerweb, census: 200; nps, fs, osm API: 301); Geofabrik reset (as known; unused).
- RIDB export: RIDBFullExport_V1_CSV.zip, files dated 2026-10-07 (the specs' export).
- osmium-tool needed `apt-get update` first (the package wasn't in the stale index).
- OSM extract us-west (openstreetmap.fr, OSM as of 2026-10-07T00:17:45Z, MD5 ok, trimmed 3.09 GB).
  **New:** osm-extract.mjs's curl has no stall timeout: after connection resets it sat for 2 hours
  having fetched 106 MB. Killed it, finished the same resumable file with
  `curl -C - --speed-limit 20000 --speed-time 45` in a loop (then 17 MB/s, 4 minutes), and re-ran
  osm-extract.mjs, which checked the MD5 and trimmed. Suggest adding `--speed-limit/--speed-time`
  to its curl (not changed here: code is out of a child's scope).

## Bar for `usable` (messages from the orchestrating session, 19:23Z, corrected 19:28Z)
Applied here, per the correction: `usable` when the sites and drawn roads are right with some spurs
or lanes missing (sites 20–40 m out on undrawn spurs still count). `hold` when a drawn road doesn't
follow the visible one, sites are misplaced or stacked, or about a third or more of the sites have
no drawn road at all. (The first message's "1 in 7" bar was withdrawn.)

## Wave 09 (us-west: OR, WA, ID, UT, WY, CA, MT, NV, AZ; multi)
- Built 94, failed 0 (build 18:52-19:33Z; first look and traces 19:34-19:59Z)
- Check: ready 60, review 33, not drawn 1 (after traces; 63/30/1 as first built)
- First look: good 24, usable 32, hold 22, unsure 16
- Traced: 233568 (Orland Buttes: every paved loop, only the entry road was drawn), 273822 (Navajo Lake: lanes north of the highway), 232347 (Bald Mountain: five spurs), 233822 (Greens Lake: middle lane to 017). Each checked over the photo after the rebuild (within about 3 m).
- Split calls: none. Tried 233263 (Bartoo Island): `gap` didn't part site 25 from 7-13 (a lone site within maxSpan/2 joins its neighbors), and `maxSpan: 400` made the listing dispersed, so the call was dropped; the default five areas follow the coves.
- Held, and why (one line each):
  - 10119398: full canopy; 001-005 sit 44-74 m from the only road.
  - 10216501: sites 1, 2, 3 stacked 3-6 m apart.
  - 10363702: no drawn road within 25 m of any site, under canopy.
  - 231963: sites in a wet meadow 45-110 m from the road; points look misplaced.
  - 232289: no road drawn; 15 sites spread 1 km.
  - 232758: most sites stacked in one knot (the check can't draw it either).
  - 232864: half the sites 43-97 m from any drawn road, under canopy.
  - 232915: the north-west ring is a coarse polygon through forest with no lane.
  - 233186: walk-in sites 001-007 and Group1 27-138 m from the RV loop.
  - 233263: boat-in, no road to any site (areas).
  - 233344: the point cluster 01-09 has no drawn lane; road hidden under firs.
  - 233844: west lane drawn 10-15 m off the visible one; end loop wider than the teardrop.
  - 234153: sites scattered 60-196 m around the loop: misplaced points.
  - 234194: dispersed sand camping over 5 km, no roads.
  - 234538: sites 37-80 m from the only drawn lane, around open dirt flats.
  - 234541: 01-09 87-128 m from any drawn road under canopy.
  - 234751: Park Service lines are straight approximations; the east one cuts between the lanes.
  - 267080: 06-10 sit 32-61 m west of the only road, along an undrawn lane under pines.
  - 267552: only the highway drawn; sites along footpaths (walk-in tents), not traced.
  - 267560: drawn curve runs through trees; the visible lanes to 001-006 aren't drawn.
  - 275029: 9-17 on the island's north end 49-98 m from any road.
  - 275092: 2-8 25-74 m across an open flat from the only road.
- Anything new: three winter (snow) NAIP frames in Utah (232104, 232139, 233824): lanes show, pads don't. Used a small script to measure each site's distance to the nearest drawn road (`dist.mjs`, scratchpad only), so the notes give measured distances rather than eyeballed ones.

## Wave 10 (us-west: UT, OR, CA, ID, WA, WY, MT, NV, AZ; multi)
- Built 94, failed 0 (build 19:35-19:59Z, alongside wave 9's first look; first look and trace 20:00-20:18Z)
- Check: ready 66, review 27, not drawn 1
- First look: good 19, usable 33, hold 30, unsure 12
- Traced: 267074 (Three Creeks Meadow: the gravel loop in the meadow past 003 to 007; checked over the photo, within about 3 m)
- Split calls: none (10060971, the Needles group sites over 4.3 km, is held: the build shows it dispersed and three sites can't make areas)
- Held, and why (first sentence of each note):
  - 232063: A winter photo, under snow.
  - 232192: Walk-in tent sites: 002 to 013 sit in the meadow and pines 24 to 69 m south of the parking lot, the only drawn road, with no lane to them.
  - 232295: The main road and loops follow the visible lanes, but the south-west sites (049 to 062) and the south-east row (026 to 034) sit 38 to 74 m from any drawn road, along lanes that show through the scrub and aren't drawn: 17 of 66 sites over 40 m, 34 over 20 m.
  - 232774: Under canopy.
  - 232828: The check can't draw it, and the photo agrees: the 14 sites sit stacked in one small knot under the trees, not on separate pads, inside a coarse polygon that isn't a road.
  - 232859: All four group sites are numbered "1" in RIDB, and they sit 33 to 41 m from the drawn loop at lots that show and aren't drawn; they can't be told apart on the map.
  - 233347: The north loops follow the visible lanes, with 01 to 09 around them.
  - 233949: Only the north end is drawn (002, 012 and 013).
  - 234008: The Forest Service ring is a coarse polygon: it cuts through the trees on its west and south sides instead of following the visible lanes, and 001 sits 27 m inside it.
  - 234103: Under canopy, the Forest Service loop is a coarse polygon whose west side runs through the trees east of the visible lane past 001 to 005; 009 sits 53 m and 010 32 m east with no lane drawn.
  - 234164: Walk-in sites on the wooded point: 001 to 008 sit 37 to 119 m from the only drawn road, along footpaths under the pines.
  - 234193: Dispersed sand camping over 5 km of dunes: the site points are scattered up to 1.1 km from any drawn track, across open sand.
  - 234208: Only the road along the creek is drawn.
  - 234455: The south loop follows the visible pavement, but the north ring's east side and the middle loop's east side cut through the trees where no lane shows, and the lot at 017 to 019 isn't drawn.
  - 234564: Under canopy.
  - 234693: Only the road around the outside is drawn.
  - 234723: The horse sites H01 to H20 sit in two straight rows across an open dirt lot, and the drawn "roads" are paddock fence lines, not lanes; the sites can't be told apart from a pad on the photo.
  - 234738: Under part canopy, the Forest Service lines are coarse: the line south-west to 04 to 06 runs through the trees east of the visible lane, and the east loop is a polygon that doesn't follow the lanes past 08 to 13.
  - 234772: The Forest Service loop's west side and its north end cut through the trees west of the visible gravel lane past 05 to 07, and the inner loop is a polygon; 06, 09 and 10 sit 25 to 29 m off.
  - 236991: Boat-in: no road is drawn or reaches the sites, which sit in a line under full canopy along the shore.
  - 249291: The loops follow the visible pavement, but most site points sit on the lane centerlines rather than at the ramadas beside them (196 to 205 down the middle of the north lane, 166 to 173 down the middle lane); the pads sit 10 to 20 m to the side.
  - 251841: The highway is drawn about 15 m east of the visible pavement, and the lot road with it.
  - 267078: The Forest Service loop is a polygon through the trees; the visible lane runs north from the highway turnout past 002 and south toward the clearing near 006 and 007, and the sites sit along the river west of the drawn loop.
  - 267081: The drawn loop is a straight-sided polygon: its west side runs 10 to 20 m east of the visible gravel lane past 01 and 02, and the curved lane in the middle doesn't follow it.
  - 267553: Only the forest road is drawn.
  - 272243: Only the road in is drawn.
  - 275085: Under part canopy, only the highway and the lot spur are drawn; 1 to 7 sit 23 to 51 m from them along lanes and paths that show faintly and aren't drawn.
  - 10040012: Under canopy.
  - 10060971: Three group sites across 4.3 km of the Needles District, shown on one map: each sits by a drawn road, but at this scale the map is unreadable; it needs a site each (Split Top sits at the far east edge).
  - 10077451: Under canopy.
- Anything new: several Forest Service loops drawn as coarse polygons through the trees (234008, 234103, 234738, 234772, 267078, 267081). Goose Island (251841): the source's highway runs about 15 m east of the visible pavement. Schoolhouse (249291): site points on the lane centerlines, not at the ramadas. Black Rock (234723): paddock fence lines drawn as roads.

## Wave 11 (us-west: UT, CA, OR, ID, WY, AZ, WA, NM, NV; multi, many group sites)
- Built 94, failed 0 (build 20:00-20:39Z, alongside wave 10's first look; first look and trace 20:39-20:50Z)
- Check: ready 58, review 33, not drawn 3 (233366, 233928, 234598)
- First look: good 15, usable 26, hold 45, unsure 8
- Traced: 267554 (Three Creeks Meadow Horse Camp: only the highway was drawn; traced the west lane with its south branch and the east lane to the teardrop loop; checked over the photo after two nudges, within about 3 m)
- Split calls: none (Buckhorn Draw 10283369, Spinreel 234201 and Horse Campground 233729 are dispersed or broken, held)
- Held, and why (first sentence of each note):
  - 120990: The drawn lanes are the parking rows by the highway.
  - 231905: The lanes follow the visible dirt roads across the flat, with group sites 1 and 3 beside them.
  - 232048: The roads follow the visible gravel, but 01, 02 and 03 sit 27 to 47 m from them among the pines, with no lanes drawn: none of the three group sites is on a drawn road.
  - 232053: No road is drawn at all, and the two group sites sit under the pines with no lane showing.
  - 232285: Under full canopy: the three group sites sit 40 to 123 m west of the only drawn road, among the pines with no lane showing.
  - 232304: The drawn ring is a coarse polygon that cuts through the trees between the visible paved lanes; group sites A, B and C sit 22 to 24 m off it, B by the lot on the north lane and C by the west lane.
  - 232455: Under full canopy: G01 and G02 sit 37 to 43 m from the only drawn road, with no lane showing through the oaks.
  - 232779: The drawn loops are coarse polygons: the south one cuts through the trees on its east side, away from the visible paved lanes, and Group C sits under the trees inside it.
  - 232840: Under canopy.
  - 232850: Under full canopy: the two drawn loops are coarse polygons that cross each other, and B, D and E sit outside them; nothing shows through the firs to confirm any lane.
  - 232910: The drawn loop is a coarse outline over the visible lot and doesn't follow its lanes, and Scout, Knoll and Lagoon sit 23 to 34 m out in the open around it at clearings reached by lanes that aren't drawn.
  - 233366: The check can't draw it: both group sites share one point in open scrub, with no road anywhere in the frame.
  - 233385: The roads follow the visible gravel, but the listing's three points (Group A, 011, 013) sit at three separate spots up to 500 m apart; a fragment of a larger campground, not a map of its sites.
  - 233729: The sites' points are scattered across four states (the frame is 515 by 1,016 km): broken coordinates, not a campground.
  - 233928: The check can't draw it: the three group sites share one point in open forest, with no road anywhere in the frame.
  - 233995: Boat-in: no road is drawn or reaches the sites, which sit among the junipers on the point.
  - 234020: Under canopy.
  - 234029: Under canopy, the drawn loop's west side cuts through the trees between the visible lanes, and 010 to 013 sit north and west of it on lanes that show and aren't drawn.
  - 234071: 002 sits at the shelters by the lot on the point, but the drawn lot road stops short of it, and 001 sits 30 m west of the drawn loop by a grove at the end of a lot that shows and isn't drawn: both sites off the drawn roads.
  - 234098: The Forest Service road through the pines follows a faint lane, but 002 to 010 sit 23 to 50 m west of it along the reservoir shore, on a lane by the water that shows and isn't drawn: most of the sites.
  - 234100: The drawn lane follows a faint track through the pines, but 002 to 007 sit 21 to 95 m west of it along the reservoir shore and 001 north of its end, with no lane drawn to them.
  - 234151: Under canopy, the loop's east lobe is a polygon through the trees, and 002 sits 27 m south and 005 and 006 east of it, with no lanes showing.
  - 234172: The four group sites sit exactly on the drawn line, evenly spaced along it, as if placed on the road rather than at the clearings beside it; the line itself runs through the trees.
  - 234174: The Census roads cross the meadow and the trees diagonally, not along the visible lanes; cabin C01 and H01 sit in open ground with the visible drive past the buildings undrawn.
  - 234190: Six sites spread 900 m along the canyon: 002 to 004 sit by the north loop (which follows the visible gravel), but 005 sits in the trees west of it, 001 by the highway and 006 at the far south end, on nothing drawn.
  - 234201: Dispersed sand camping along 3.7 km of dune track: the sites are points beside the sandy track through the scrub, 22 to 65 m from it, spread too far for one map.
  - 234348: Under canopy, the drawn roads follow the visible gravel, but group sites A and C sit in the forest 32 to 41 m off them, and D sits 145 m from any road at the far south-east, with nothing drawn to it.
  - 234401: Under canopy, the drawn loops are coarse polygons: the big loop cuts across the trees through the middle of the sites, and 008 to 010 and 013 sit outside it with no lanes drawn.
  - 234593: Census lines everywhere cut through the forest instead of following the visible lanes, and the four group sites sit among the trees between them; only the lane by the buildings fits.
  - 234598: The check can't draw it, and the photo agrees: 004 to 008 and Host sit in full canopy south of the road's end with 005 and Host stacked, and 010 sits 300 m away among houses north-east.
  - 236938: Boat-in: no road is drawn or reaches the sites, which sit on the rocky shore and under the firs above it.
  - 237056: Boat-in: no road is drawn or reaches the sites, which sit along the beach of the cove.
  - 251454: The horse sites sit 24 to 66 m from the drawn loop and road, scattered among the pines (001 to 006 east, 007 to 009 west), along lanes that show faintly and aren't drawn: every site is off the drawn roads.
  - 251886: Under canopy, the drawn loop is a coarse polygon whose lines cut through the trees; the visible lanes past 001 to 005 and 008 to 013 run outside it, and the sites line them, not the drawn loop.
  - 256893: Only the road along the south edge is drawn (Census).
  - 266137: Under canopy.
  - 267557: Under canopy, the drawn loop is a coarse polygon across the trees, and 001 to 004 and 007 to 009 sit outside it along lanes that show faintly and aren't drawn (007 47 m).
  - 273379: The sites sit stacked in a short row 5 to 10 m apart (001 to 005) at the end of a drawn loop that cuts across the trees; the visible lanes run parallel to the north and south of it, and the pads can't be told apart.
  - 10008944: Under full canopy, the two Census lines cross each other without a junction, and the west one runs through the trees where no lane shows; the visible lane is the east one, and 1 to 17 sit west of it.
  - 10048998: The road and the south loop follow the visible gravel, with 01, 09 to 12, 14 and 15 near them.
  - 10114427: The drawn loop is a coarse outline: its west side cuts through the trees between the visible lanes, and the lanes to 006 to 009 and the lot by 008 show and aren't drawn (008 42 m).
  - 10220609: The two horse sites sit 38 to 43 m south of the drawn road, in a clearing reached by a lane that shows and isn't drawn: neither site is on a drawn road.
  - 10283369: Dispersed river camping along 8 km of Buckhorn Draw: no roads drawn, and the sites are scattered points across the canyon.
  - 10299310: The forest road and the spur to the lot follow the visible gravel, with 1, 2, 3, 10 and 11 near them.
  - 10299335: Under canopy.
- Anything new: 233729 (Horse Campground, CA): its site points span four states (a 515 by 1,016 km frame), broken coordinates in RIDB. 234172 (Bear River Group): site points evenly spaced on the road line itself. Many small group-site listings whose sites sit 30 to 50 m from the drawn lot at their shelters or clearings; held where none or most of the sites are off a drawn road. Three Cultus Lake boat-in listings (236938, 237056, and wave 10's 236991) have no roads by nature.

## Totals
- 282 maps built (94 a wave), none failed.
- First look: good 58, usable 91, hold 97, unsure 36.
- Traced 6 maps: 233568, 273822, 232347, 233822 (wave 9), 267074 (wave 10), 267554 (wave 11). Other gaps were under canopy, footpaths, or gravel flats too wide to place a line.

Time: setup 16:37-18:52Z (about 2 h 15 min, mostly the stalled OSM download); wave 9 18:52-20:00Z; wave 10 19:35-20:18Z (build overlapped wave 9's look); wave 11 20:00-20:50Z (build overlapped wave 10's look).

STATUS: complete
