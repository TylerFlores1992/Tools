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
- First look: good 29, usable 30, hold 20, unsure 11
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

STATUS: started
