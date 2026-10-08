# Batch west-a

Waves 3, 4, 5 (us-west, multi). Branch wip/maps-west-a.

## Setup (2026-10-08)
- Network: every host in playbook §3.4 answered (200/301) except download.geofabrik.de (connection reset, as known; not needed: the extract comes from openstreetmap.fr).
- RIDB export: RIDBFullExport_V1_CSV.zip, files dated 2026-10-07 (the same export the specs were planned on).
- osmium-tool 1.16.0 from apt (needed `apt-get update` first).
- OSM extract us-west: OSM as of 2026-10-07T00:17:45Z, 3.76 GB raw, MD5 ok, trimmed to 3.09 GB. Took about 5 minutes.

## Wave 03 (us-west, multi)
- Built 94, failed 0
- Check: ready 56, review 38, not drawn 0 (after traces and split rebuilds; first build was ready 61, review 33)
- First look: good 30, usable 26, hold 22, unsure 16
- Traced: 10332664 (Hole-in-the-Wall), 232496 (Furnace Creek), 233730 (Mirror Lake), 247867 (Alpine Meadow), 251535 (Needles: `replace`, every road retraced, they ran 10 to 20 m off). Every trace checked over the photo after the rebuild (5 m zooms for Furnace Creek and Alpine Meadow).
- Traces drafted and dropped: 233439 (Buckhorn) and 233585 (Pine Meadows). Both stay held for other reasons, and the Pine Meadows lanes couldn't be joined to the highway from the photo; I didn't commit lanes I couldn't check to 3 m.
- Split calls: 232498 (Scorpion, gap 150: two groves, each frame one cluster), 233585 (Pine Meadows, gap 150: three areas, each one cluster). Lake Sonoma boat-in (233431) not called: the build already treats it as dispersed, so a call changes nothing.
- Held, and why (22):
  - 231907 LUCERNE CAMPGROUND: the lanes in every camping loop run 10 to 15 m off the pavement; needs a hand retrace (too dense a web to trace from a grid to 3 m).
  - 232801 SPRING COVE: 018 to 022 and 028 to 042 sit in neat lines on open hillside, 20 to 70 m from any road or pad.
  - 233390 SAN ANTONIO CAMPGROUND: the north cluster (011 to 019, GA) has no road; its lanes are too faint under the pines.
  - 251537 LITTLE CRATER CAMPGROUND: the shore road runs 5 to 10 m off the pavement and the lakeside lanes are not drawn.
  - 256932 Big Meadow Campground - US Forest Service Sequoia National Forest (CA): most sites 30 to 100 m from the drawn spurs, and a far cluster with no road.
  - 10083845 Tamarack Flat Campground: 001 to 006 sit 30 to 70 m from any road.
  - 232448 Tuolumne Meadows Campground: the A loop, most of B and the H loop have no road (canopy).
  - 232489 North Rim Campground (AZ): the outer ring of sites has no road.
  - 234039 MANZANITA LAKE: loops drawn as smooth bubbles off the visible lanes; sites 20 to 50 m outside them.
  - 234040 SUMMIT LAKE SOUTH: loops drawn as smooth bubbles off the visible lanes; sites 20 to 50 m outside them.
  - 234060 Newhalem Creek Campground: whole groups of sites with no road, under closed canopy.
  - 234156 BUTTE LAKE: loops drawn as smooth bubbles off the visible lanes; sites 20 to 50 m outside them.
  - 247586 Staircase Campground: whole groups of sites with no road, under closed canopy.
  - 249979 POTWISHA CAMPGROUND: only the entrance road is drawn; the lanes between the oaks show but branch too finely to trace to 3 m (for the tracing tool).
  - 233414 Codorniz Recreation Area Campground: drawn roads 10 to 20 m off the pavement in places.
  - 233431 BOAT-IN SITES (LAKE SONOMA): boat-in sites in dispersed coves, no roads.
  - 233439 BUCKHORN: BH66 to BH92 in a generated-looking arc; the lakeside lanes are not drawn.
  - 233489 Downstream (MT): smooth rings off the faint lanes; 01 to 12 sit 15 to 25 m off.
  - 233532 KYEN CAMPGROUND AND OAK GROVE DAY USE AREA: under oaks, many sites 30 to 50 m from any road.
  - 233585 PINE MEADOWS CAMPGROUND: only the highway is drawn (now three areas).
  - 233623 SCHWARZ PARK: only the through road is drawn.
  - 233692 HORSE CREEK: 81 to 84 are placed in the lake.
- Anything new: tall frames (Hole-in-the-Wall, 229 x 694 m) make `aerial-grid.mjs` fail at the default 1600 px width ("unsupported image format": USGS's 4,000 px limit); a box with width 1200 works. Bubble-shaped OSM loops (Lassen: Manzanita, Summit, Butte) are a recurring hold. USGS water timed out a few times; the build fell back to OSM water.
- How the look was done: four helper agents each read every overview PNG of about 24 maps and zoomed the wide frames; I checked every trace and split myself. One helper's images stopped loading partway (a per-agent image limit), so the 13 maps it couldn't see were judged again from scratch by two fresh helpers; no call rests on an unseen photo. I moved Little Crater (251537) from usable to hold and Needles (251535) and Mirror Lake (233730) to usable rather than good after tracing.
- Time: about 55 minutes (build 12, first look and traces the rest).

## Wave 04 (us-west, multi)
- Built 95, failed 0
- Check: ready 54, review 40, not drawn 1 (250036 Green River float-in: dispersed), after traces; first build was ready 58, review 36
- First look: good 24, usable 34, hold 17, unsure 20
- Traced: 10085599 (Baker Dam: the lane north to 2 and 3; now good), 233182 (Sandy Flat), 233283 (Pyramid Lake Los Alamos: the group sites' road), 234488 (Tusayan Montane: loop B's north lane), 234578 (Lagoon: the north lane; I moved it 3 m south onto the pavement and dropped a drafted lane past 13A that I couldn't place under the trees), 234722 (Demotte). Every trace checked over a 5 m zoom after the rebuild.
- Split calls: none (Hyatt Lake 250031 is already four areas, each one cluster; Diamond 233869 five areas, each one cluster).
- Held, and why (17):
  - 250031 Hyatt Lake Recreation Area: Middle 2 (29 to 45) has no road; its lane shows only in pieces under the pines (already four areas, one cluster each).
  - 121390 NASON CREEK CAMPGROUND: under canopy, many sites well away from any drawn road.
  - 231954 WRIGHTS LAKE: in the south area 041 to 054 sit 20 to 50 m east of the drawn loop, along an undrawn lane with parked campers.
  - 231962 MCGILL CAMPGROUND AND GROUP CAMPGROUND: sites sit on the road line, and many pairs or triples share one spot.
  - 232039 DUCK CREEK: many visible gravel lanes missing; dozens of sites 20 to 60 m off (too many for a few traces).
  - 232878 Forks Campground (Sierra): only the east half of the loop is drawn; 003 to 016 have no road.
  - 233117 CERRO ALTO CAMPGROUND: no road drawn at all; no lane shows under oak and chaparral.
  - 233869 DIAMOND: no road drawn at all; loops A and B have plainly visible lanes and pads, so it is a good candidate for the tracing tool (every road traced).
  - 234009 PHILIPSBURG BAY CAMPGROUND: drawn roads are straight-sided outlines 10 to 15 m off the lanes in places.
  - 234114 BOCA CAMPGROUND: drawn roads only loosely follow the dirt tracks; several sites have no road.
  - 234115 BOCA REST CAMPGROUND: drawn roads 4 to 10 m off the visible gravel; two inner roads missing (a full retrace with the tracing tool).
  - 234711 Crescent Lake Campground: 017 to 033 have no road, under firs.
  - 234756 CHERRY VALLEY: drawn roads are rough straight lines 10 m+ off the lanes; many sites 20 to 40 m off.
  - 250036 GREEN RIVER FLOAT-IN CAMPSITES: float-in camps along 7 km of canyon, no roads; the build already treats it as dispersed.
  - 251365 FALLS CREEK CAMPGROUND: 023 to 031 and 009 to 012 have no road, under dense canopy.
  - 251580 CULTUS LAKE CAMPGROUND: 001 to 016 sit 30 to 80 m into the forest with no lane; the lakeshore row 20 to 30 m off.
  - 10044710 Atwell Mill Campground: only the through road drawn; sites 30 to 60 m off it in the forest.
- Anything new: nothing new. Tracing-tool candidates: Diamond (233869, no roads but plain lanes) and Boca Rest (234115, a full retrace). The USGS water service timed out often, which made the build slow (about 80 minutes); it fell back to OSM water.
- Time: about 85 minutes (build about 80 of it, overlapping wave 3's look).

STATUS: started
