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
- Check: ready 41, review 44, not drawn 2 (before split calls and traces; the split rebuilds
  turn some ready maps into review)
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
