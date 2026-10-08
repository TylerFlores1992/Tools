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

STATUS: started
