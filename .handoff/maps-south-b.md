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
