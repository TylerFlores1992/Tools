# Batch south-a

Waves 14, 15, 16 (us-south, multi). Branch wip/maps-south-a.

## Setup
- Network: ridb, imagery/hydro.nationalmap, tigerweb, services2.arcgis, tylerflores.dev 200; nps,
  fs.usda, api.openstreetmap 301 (answering). download.geofabrik.de resets (as the playbook says);
  not needed: osm-extract.mjs reads openstreetmap.fr.
- RIDB export: RIDBFullExport_V1_CSV.zip, files dated 2026-10-07 18:45 (same as the specs').
- osmium-tool: needed `apt-get update` first (then 1.16.0).
- OSM extract us-south: OSM as of 2026-10-07T00:16:44Z, 4.59 GB raw (MD5 ok), trimmed 3.81 GB;
  downloaded in about 10 minutes.


## Wave 14 (us-south, multi)
- Built 90, failed 0 (233099 Dam Site River failed once on `osmium getid` of an OSM relation; the retry built it)
- Check: ready 48, review 40, not drawn 2
- First look: good 29, usable 27, hold 23, unsure 11 (after the corrected bar; first pass was usable 30, hold 20)
- Traced: 246892 (lane past 27 to 36), 232630 (west loop past 49 to 53), 233125 (spine past 013 to 022, lane past 005 to 009), 233473 (entrance road, point loop past 38 to 48, road past 69 and 70), 233445 (shore lane past 001 to 012). All checked over the photo after the rebuild; I dropped one 233473 lane (east point) that I couldn't place within 3 m.
- Split calls: 232659 (three fingers), 234043 (group sites G2 to G5 900 m west), 233531 (three fingers, gap 150)
- Held, and why:
  - 10028875: Big Bend backcountry, 45 km of places, no roads
  - 251431: sites listed twice (013 and B013 on one pad), not drawn
  - 253730: Cumberland Island permit sites over 14.6 km, no roads
  - 232555: no campground roads; lanes hidden under pines
  - 232574: inland loop 037 to 063 undrawn, under canopy
  - 232575: 27 to 50 on wooded fingers, no roads
  - 232606: five areas right, but sites 30 to 45 m off Census roads under pines
  - 232623: Census loops cut across visible lanes; north point undrawn (needs a replace trace)
  - 232637: north sites with no lanes; 066 to 075 strung along the road
  - 232655: no roads; site 22 placed 14 km away
  - 232669: only one road drawn; row lanes under canopy
  - 232699: south area's drawn loop cuts through the trees, 50 to 63 have no road
  - 232730: no campground roads drawn; lanes too broken to trace
  - 232735: sites 40 m or more from drawn roads; canopy
  - 233434: north peninsula (28 to 54) almost undrawn
  - 233643: south area's roads cut across fields; the circle isn't drawn
  - 233687: only the access road drawn
  - 233703: no roads; E21 placed 28 km away
  - 233099: lanes to 13 to 59 undrawn under trees
  - 234651: island roads cut across lawns (needs a replace trace)
- Anything new: USGS water (hydro.nationalmap.gov) timed out on many maps and the build fell back to OSM water, which made the build slow (about 80 minutes for 90 maps). Two listings (232655, 233703) each have one site placed 14 to 28 km away, across the lake from the rest.
- Time: build 16:22 to 17:30; first look and traces overlapping, done 17:46.


## Wave 15 (us-south, multi)
- Built 91, failed 0 (232562 Cricket Creek and 232619 Lakeview Park failed once on `osmium getid` of an OSM relation; the retry built both)
- Check: ready 44, review 46, not drawn 1 (after the split rebuilds)
- First look: good 12, usable 18, hold 47, unsure 14 (after the corrected bar; first pass was usable 34, hold 31)
- Traced: 251938 (west loop past 017 to 022), 232582 (road through the campground and the west loop past 18 to 39). Both checked over the photo after the rebuild; nudged 251938's south arc by 3 m.
- Split calls: 232513 (five fingers), 232557 (two), 232602 (two, 900 m), 233469 (two across a cove), 233527 (three either side of a bridge), 233581 (two across a marina), 234665 (loop and group sites 1 km off), 234726 (two loops 1 km apart). All rebuilt and looked at; the areas follow the real places.
- Held, and why:
  - 10218892, 240242: half the sites have no road, under full canopy
  - 232423: not drawn (27% stacked); sites between and outside the loops
  - 232513: five areas right, but the long point and two fingers have no roads
  - 232515: sites 20 to 40 m off the visible roads all round; points look shifted
  - 232568, 232722: no campground roads; lanes under canopy
  - 232571, 232562: only a through road; sites in the trees 30 to 60 m off
  - 232582: traced the west half; the east point is under canopy
  - 232609, 232747, 233457, 233508, 234478, 232698: drawn roads cut across lawns or trees beside the real lanes (replace traces needed)
  - 232634: north area's lanes drawn in the wrong places; south under canopy
  - 232665, 232684, 232662, 233650: no campground lanes drawn though they show plainly (trace candidates)
  - 232677: almost nothing drawn; lanes only in pieces
  - 232704, 233590: most visible lanes undrawn
  - 233493: lanes by the river and in the east woods undrawn
  - 233527, 233581: splits right, but the visible lanes in each aren't drawn
  - 233616: four places; east loops cut across trees, west sites have no road
  - 233633: 01 to 30 in the west woods with no road, 300 m from the loop
  - 233658: no roads; site 25 placed 14 km away
  - 233678: north arm's road 5 to 15 m off the gravel lane
- Anything new: the hold share is higher than wave 14 (31 of 91). Most of the extra holds are not canopy: OSM in eastern Oklahoma and Arkansas often has the park road but not the campground lanes, or has them drawn off the pavement. Fourteen of the holds (232665, 232684, 232662, 233650, 232609, 232747, 233457, 233508, 234478, 232698, 232704, 233590, 232634, 233678) have lanes plainly visible in the open and could be traced (several need a replace trace). I didn't trace them all in this batch, to leave time for wave 16. A third listing (233658) has one site placed 14 km off.
- Time: build 17:46 to 18:21 (with rebuilds); first look done 18:34.

## The usable bar (messages from the orchestrator, 19:23 and 19:28)
- session_01G3DBCNs1edHEgLMktsQNGv (the orchestrator, by its own account) first sent a 1-in-7 bar for `usable`, then five minutes later corrected it: `hold` when a drawn road doesn't follow the visible one, sites are misplaced or stacked, or about a third or more of the sites have no drawn road; sites 20 to 40 m out on undrawn spurs stay `usable`. Both said the brief on main matches; at 19:30 main's brief still had the original wording. I applied the corrected bar, since it matches the original brief's "a loop with nothing drawn".
- Re-called from my notes, which name the sites off (no photos re-opened). Under the corrected bar: wave 14, 3 of 30 usable became hold (232539, 234181, 233473); wave 15, 16 of 34 (251938, 273848, 232528, 232547, 232585, 232651, 232619, 232672, 232746, 233430, 233466, 233526, 233572, 233647, 233666, 233698); wave 16 was called under it, with the reason ending each note ("Held: ...").


## Wave 16 (us-south, multi)
- Built 90, failed 0 (232621 Lead Hill failed twice on `osmium getid` of OSM relation r6265485, the same relation that broke 232619 in wave 15; the third try built it)
- Check: ready 48, review 42, not drawn 0 (after the split rebuilds)
- First look: good 9, usable 14, hold 57, unsure 10 (called under the corrected usable bar)
- Traced: 233913 (the three gravel lanes of the horse camp), 10040524 (main road and the loop round the lawn), 232640 (loop B's west arm and north bend, D's turnaround). All checked over the photo after the rebuild.
- Split calls: 10001451, 232560, 232917, 233436, 233446, 233448, 233511, 233584, 251355. All rebuilt and looked at; the areas follow the real places.
- Held, and why:
  - 10119481: Site 4 is placed thousands of kilometres away (the frame is 6,000 km wide), and the other 21 sites have no roads to draw: not a usable map.
  - 250860: Paddle-in camping platforms spread over 38 km of swamp (Big Water, Floyds Island, Round Top, Cedar Hammock), with no roads: a list of places, not a site map.
  - 233319: The drawn loop runs through the middle of the woods while the sites sit on clearings off it: the lane along the west side past 001 to 012 and the spurs to 015 to 017 and 022 to 026 show as gaps in the canopy and aren't drawn.
  - 233343: The drawn loops cut through the trees beside the real lanes: the gravel lane past 003 to 012 runs east of the drawn one, 016 to 018 and 019 to 029 sit off any drawn road, and the lanes to them show only in pieces under the pines.
  - 234718: over a third of the sites (02 to 09, 36 to 41) have no drawn lane
  - 234575: half the sites (017 to 036, 040 to 044) have no drawn lane
  - 273352: The sites are placed on a neat grid (02 to 76 in rows 10 m apart) in the woods beside the office, not on pads: invented positions
  - 10001451: the tent area, two thirds of the sites, has no drawn road
  - 251854: Boat-in permit sites spread over 12 km of lagoon islands (Shipyard, Homestead, Orange Island, the Dredge sites), with no roads: a list of places, not a site map.
  - 233119: over a third of the sites (walk-ins A to J, G1 to G5) have no road or path
  - 258992: the drawn road runs 10 m off the gravel
  - 10012078: The Census roads run down the middle of the wooded point, but most sites (1 to 9, 16 to 32, 36 to 47, 60 to 62) sit 20 to 50 m off them on clearings where the lanes show only in pieces under the oaks.
  - 10035048: The Census lines cut across the campground: the lanes past 01 to 09 in the east woods and past 19 to 27 in the north show in pieces under the trees and aren't drawn, and most sites sit 20 to 40 m from any drawn road.
  - 10054654: about half the sites (the C and D rows) have no drawn lane, and some share a spot
  - 232552: over a third of the sites (02, 03, 05 to 10) have no drawn lane
  - 232558: The drawn loops run through the woods while the sites sit on clearings off them: 18 to 30 along the river lane, 11 to 16 by the east lane and 02 to 09 west of the south loop, all 20 to 40 m off any drawn road where the lanes show only in pieces.
  - 232560: drawn roads off the visible lanes
  - 232611: Shown as two areas 1.5 km apart along the lake, and they follow the real places
  - 232640: Traced loop B's west arm and north bend past B-08 to B-14, and D's turnaround and lane to D-09, from the photo
  - 232628: the south-west lanes are drawn 5 to 10 m off the gravel
  - 232667: about a third of the sites (C sites, B-08 to B-10, A-13 to A-16) have no drawn road
  - 232663: The drawn loop on the island cuts across the grass inside the real one, and the visible road along the south bank past 20 to 38 is drawn only in part; 13 to 19 in the west woods and 33 to 38 sit off any drawn road.
  - 232685: The drawn lines cut through the pines and across the lot while the real paved loops (past 33 to 49 and 57 to 60) run beside them, and 38 to 41 and 61 to 65 sit off any drawn road.
  - 232688: loop B (B-01 to B-09), over a third of the sites, has no drawn lane
  - 232701: over half the sites (15 to 32) have no drawn lane
  - 232709: The drawn loops in the middle run through the trees with no sites on them, while the sites sit off them: 29 to 49 on the north shore 50 to 100 m from any drawn road, 009 to 017 below the east loop, and E01 to E10 stacked at one end of the east lot.
  - 232713: Only the outer roads round the blocks are drawn
  - 232717: a third of the sites (D-13 to D-22, the C sites) have no drawn lane
  - 232751: Only the road down the spine is drawn, and the canopy hides the lanes off it: 001 to 015 sit either side of it in the trees, and the south islands' sites (023 to 030, 032 to 042) sit 30 to 80 m from any drawn road.
  - 233100: a drawn spur cuts across the lawn
  - 233170: drawn lines cross the lawn
  - 233278: over a third of the sites (025 to 033, 007 to 009) have no drawn lane
  - 233415: Only the road through the middle is drawn; most sites (01 to 19 in the west, 33 to 46 in the east) sit 40 to 100 m from it in the woods, on clearings the photo shows but with the lanes between them hidden by the canopy.
  - 233429: The drawn lines are field and park outlines, not the lanes: they cut across the lawns and trees while the real paved loops (past 08 to 21, 26 to 35 and 02 to 06) show plainly beside them and aren't drawn.
  - 233436: a whole row has no drawn road
  - 233446: over a third of the sites have no drawn road
  - 233409: Most of the lanes the sites sit on show plainly and aren't drawn: B and C (B015 to C033) have no road, the F lanes past F069 to F081 and the E lane past E054 to E064 are drawn only in part, and the D loop's sites sit outside the drawn ring.
  - 233456: a drawn spur in the middle woods follows no lane
  - 233464: The drawn lines are mostly area outlines, not lanes: they loop round blocks of trees while the real lanes the sites sit on (past 070 to 111, 001 to 050 along the shore, G001 to G010) show in pieces through the trees and aren't drawn.
  - 233448: most sites have no drawn road
  - 233500: The drawn lanes cut across the lawns between the rows while the real gravel lanes run elsewhere: the lane past 03 to 16 runs east of the drawn one, 18 to 24 sit off the drawn diagonal, and the loop past 25 to 35 is drawn outside its visible track.
  - 233511: about a third of the sites have no drawn road
  - 233515: No roads to draw, and under full canopy no lane shows: 49 sites spread across a wooded point with nothing to reach them by.
  - 233529: Shown as four areas round the park's points, and they follow the real clusters
  - 233584: a whole row has no drawn road
  - 233579: drawn roads off the visible lanes
  - 233630: over a third of the sites have no drawn road
  - 233667: drawn roads off the visible lanes
  - 233790: over a third of the sites have no drawn road
  - 233589: a drawn road off the visible lanes
  - 233828: No roads to draw
  - 233946: most sites have no drawn road
  - 233641: drawn roads off the visible lanes
  - 234253: the drawn lines don't follow any lane
  - 251574: drawn road off the visible lane
  - 251355: most sites have no drawn road
  - 232621: sites stacked
- Anything new:
  - The hold share is highest here (57 of 90). Most holds aren't canopy. In eastern Oklahoma, Arkansas and Texas, OSM often has the park roads and outlines but not the campground lanes (233429, 233464 and 234253 draw area outlines as if they were roads), or has the lanes drawn beside the pavement.
  - Three new failure modes: 10119481 has one site placed thousands of km away (the frame is 6,000 km wide); 273352 has sites on an invented 10 m grid; 232621 has many sites stacked two or three to a pad.
  - Trace candidates (lanes plainly visible in the open, not done for time): 232663, 232685, 233579, 233589, 233667, 233641, 251574, 233409, 233790, 233448. Several of these need a replace trace.
- Time: build 18:35 to 19:30 (with retries); first look done 19:39.

## Totals
- Waves 14, 15, 16: 271 maps built, 0 failed in the end (4 osmium relation failures, all built on retry).
- First look: good 50, usable 59, hold 127, unsure 35.
- Traced 10 maps; 21 split calls.

STATUS: complete
