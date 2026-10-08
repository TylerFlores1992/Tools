# Batch midwest

STATUS: started

Setup: RIDB export of 2026-10-07 (same as the specs). OSM extract us-midwest from
openstreetmap.fr, OSM as of 2026-10-07T00:18:43Z (2.79 GB raw, 2.25 GB trimmed; about 75 min
to download). `osmium-tool` needed `apt-get update` first. Network probe: ridb, USGS imagery and
hydro, TIGERweb, ArcGIS 200; NPS, Forest Service and OSM API 301; tylerflores.dev and Geofabrik
reset the connection (not needed here).

## Wave 19 (us-midwest, multi)
- Built 87, failed 0. Two failed the first run and built on the retry: 233173 (an `osmium getid`
  of relation r4039486 failed once) and 234044 (a timeout).
- Check: ready 39, review 46, not drawn 2 (after the split calls and traces; 41 ready before)
- First look: good 22, usable 40, hold 18, unsure 7
- Traced: 233498 (Fishermans Corner: no campground road was drawn), 255134 (Left Tailrace: only
  the outer roads were drawn)
- Split calls: 232604, 233465, 233468, 233553, 233559, 233631, 233651 (gap 100), 233659 (gap 120);
  233468 gap 100, 233553 gap 80, 233631 gap 120. 233465 tried with gap 100: frames overlapped,
  so no gap (two areas).
- Held, and why:
  - 10288329, 234526, 249981, 251865: backcountry or boat-in sites spread over 8 to 50 km, no
    roads: wait for the dispersed-area design.
  - 256367, 233697: not drawn (most sites share a spot), rightly.
  - 232540: the west block (49 to 75) has no road drawn, lanes plain on the photo.
  - 233412: 050 to 061, 075 to 079 and the east cluster have no road drawn.
  - 233425: the whole C area (C001 to C114) has no road drawn; lanes plain.
  - 233441: no roads drawn although lanes are plain, and A029 is placed 8 km away.
  - 233467: north block and west row have no road drawn.
  - 233468: only the entry roads drawn; every point's lanes are plain.
  - 233471: A13 to A30 sit 40 m from the only drawn road.
  - 233505: B19 is placed 33 km south: a misplaced point in RIDB.
  - 233510: main area under full forest with no road and nothing to trace.
  - 233547: the drawn road runs 30 to 60 m off the visible pavement; lanes not drawn.
  - 233689: no road drawn to the north cluster (01 to 38).
  - 233786: Census loops 10 to 20 m off the visible lanes.
- Trace candidates not done (lanes plain on the photo, open ground): 233425, 233468, 233441,
  232540, 251160, 233547 (needs `replace`), 233786.
- Anything new: the build's first run left two failures that a plain retry fixed. USGS water often
  doesn't answer and the build falls back to OSM's water.

## Wave 20 (us-midwest, multi)
- Built 86, failed 0. Four failed the first run and built on the retry: 234613 and 232521
  (`osmium getid` of a relation failed once), 10038827 and 232732 (timeouts).
- Check: ready 47, review 39, not drawn 0 (after the split calls and traces; 49 ready before)
- First look: good 28, usable 38, hold 6, unsure 14
- Traced: 233896 (Sylvan Park: no campground lane was drawn), 233813 (Eggerts Landing: three
  lanes through the woods), 232732 (Viola: the middle lane past 39 to 53)
- Split calls: 232002, 232391, 233774, 234080, 233481, 233602, 234677 (gap 100), 251948 (gap 100)
- Held, and why:
  - 231999: only the outer loop drawn; inner lanes and the shore row missing, partly visible.
  - 273358: ten boat-in or walk-in sites scattered round a lake: dispersed-area design.
  - 233419: only the entry and one lane drawn; the east, north and south lanes are plain.
  - 233438: the Census lane to the F area runs 40 to 80 m from the visible F lane.
  - 233533: no campground road drawn and the lanes don't show under the canopy.
  - 233680: the A sites (A01 to A30) have no road; the shore lane shows only in part.
- Trace candidates not done (lanes plain on the photo): 233419, 233427, 233438 (needs
  `replace` for the F lane), 233832, 234647 (the A shore lane), 156340, 10038827, 231842.
- Many Forest Service campgrounds in Minnesota, Michigan and Wisconsin are under full canopy:
  14 `unsure`.

## Wave 21 (us-midwest, multi)
- Built 87, failed 0. One failed the first run and built on the retry: 232720 (`osmium getid`
  of relation r6265485 failed once, the same relation as 232521 in wave 20).
- Check: ready 60, review 26, not drawn 1 (after the split call and traces; 61 ready before)
- First look: good 12, usable 34, hold 20, unsure 21
- Traced: 234093 (Mineral Lake: the loop shows as a gap in the canopy), 10159237 (Neosho Park:
  the lanes off the loop)
- Split calls: 10058259
- Held, and why:
  - 233210: not drawn (every site on one spot), rightly.
  - 232325: several parts reuse numbers 001 to 007; rows 50 to 150 m from any road.
  - 233141: the Census roads miss the lanes (a `replace` trace candidate; the meadow is open).
  - 233342: most sites 40 to 100 m from any road under full forest.
  - 233769: no road to any site under full forest.
  - 233850: no campground road drawn; the lanes show between the trees.
  - 234790: two cabins 4 km apart on Grand Island: two single units, not a site map.
  - 255120: the drawn loop doesn't match the sites under canopy.
  - 255123: two clusters across a marsh, the south one with no road.
  - 273333, 273334, 273342, 273346, 273347, 273355, 273357, 273361, 232456: dispersed lake or
    island sites, 300 m to 4 km apart: dispersed-area design.
  - 10177518: 11 to 17 sit in an open field 60 to 100 m from any road; the ramp lanes not drawn.
  - 232720: the A sites are placed out in the lake, 50 to 150 m off shore (RIDB points wrong).
- Anything new: 10064546 (River Run Park): the NAIP photo was taken in a flood; the park is under
  water, so `unsure`. Many small Forest Service lake campgrounds in this wave are under full
  canopy (21 `unsure`).
- Trace candidates not done: 233850, 233141 (needs `replace`), 254084 (open south-east lanes),
  10159225 (the south shore lane), 10177518 (ramp lanes).
