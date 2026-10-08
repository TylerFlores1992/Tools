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
- Built 94, failed 0 (build 18:52-19:34Z)
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

STATUS: started
