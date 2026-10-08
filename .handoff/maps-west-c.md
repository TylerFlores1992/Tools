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

STATUS: started
