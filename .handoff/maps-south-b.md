# Batch south-b

STATUS: started

RIDB export: RIDBFullExport_V1_CSV.zip, Last-Modified 2026-10-07 18:46 GMT (the planned export).
OSM extract: us-south from download.openstreetmap.fr, OSM as of 2026-10-07T00:16Z (4.59 GB raw, MD5 ok; 3.81 GB trimmed, 8 min).
Network: every map host answered (Geofabrik still resets, not needed).

## Wave 17 (us-south, multi)
- Built 90, failed 1: 159090 Mill Run (Youghiogheny River Lake). `osmium getid -r … r2170778` exits 1 with "Did not find 1 object(s)": the lake's relation has a member outside the us-south extract (the lake crosses into Pennsylvania). The output is complete otherwise; osm.mjs treats exit 1 as failure. Needs a code change (tolerate missing members, or read it from us-northeast); retried once, same.
- Check (after traces and the split): ready 42, review 46, not drawn 2
- First look: good 24, usable 26, hold 16, unsure 24
- Traced (11): 10035081, 10035281, 10039071, 10052170, 232522, 232587, 232733, 233444, 233591, 233619, 251904 (each checked over the photo after the rebuild; 233444 moved twice until it sat on the lanes)
- Split calls: 10053793 (Pat Mayse East: two loops 800 m apart; now 2 areas, each one loop)
- Held, and why:
  - 10011396: all sites stacked in one spot (not drawn)
  - 10052638: all sites on one point in a field (not drawn)
  - 10128465: 20 boat-in sites over 20 km of shore (dispersed, not drawn as areas)
  - 10049434: loop B has no road, its lane runs out of frame
  - 10124956: no road; lanes in pieces, sites share spots
  - 10058090: areas over 1.8 km, no road along either shore of sites
  - 232258: one site 1.3 km across the lake; the east road only partly drawn
  - 232009: north sites outside drawn rings under full canopy
  - 232548: 47 of 52 sites under canopy with no road
  - 232668: 90 sites, lanes too many and faint to trace
  - 232714: paved lanes visible but too branched to trace confidently
  - 232733: traced the shore road, but most sites still have no lane
  - 233495: parallel road lines cut across the field (bad source geometry)
  - 233564: drawn roads don't follow the lanes
  - 233591: traced the road in, but 01 to 11 and 20 under canopy with no lane
  - 250013: the drawn road runs straight through trees; the real lane bends away
- Anything new:
  - The osmium exit-1 failure above (a relation crossing the extract's edge).
  - "USGS water didn't answer" on many maps (OSM water used instead), as before.
  - aerial-grid.mjs can fail with "unsupported image format" on tall frames at 1600 px; 1400 px works.

## Wave 18 (us-south, multi)
- Built 90, failed 0 (10238165 Pax River Hog Point timed out once; the retry built it)
- Check (after traces and the split): ready 54, review 34, not drawn 2
- First look: good 24, usable 24, hold 18, unsure 24
- Traced (3): 233809, 232257, 232434 (each checked over the photo after the rebuild)
- Split calls: 10050235 (Blue Ridge Park: two clusters 800 m apart; now 2 areas, each one cluster)
- Held, and why:
  - 10052192: sites spread over 56 km, no road, most on one spot
  - 10187111, 10236797: all sites stacked on one point (not drawn)
  - 10050235: split into 2 areas, but neither has a usable road
  - 10050257: no road; sites under full canopy
  - 10238170: G01 to G09 sit 100 to 250 m from the only drawn road
  - 10322742: the drawn ring follows nothing; sites under canopy
  - 232482, 232484, 251908: drawn rings don't follow the visible lanes
  - 232596: west loop wrong; east point has no road to its sites
  - 232625: paved lanes to B1 to B11 and 20 to 34 visible but too branched to trace safely
  - 232657: a straight line through the middle, plus a housing subdivision's streets drawn in the frame
  - 232700: drawn roads only partly follow the lanes under pines
  - 232707: one straight line; sites under full canopy
  - 232749: two points 1.3 km wide with no roads to the sites
  - 233814: one road between the loops; B and C sites under canopy
  - 234703: road ends at a lot; the sites' lanes don't join it
- Anything new: nothing beyond wave 17's notes.
