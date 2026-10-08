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

## Bar for `usable` (message from the orchestrating session, 19:23Z)
Applied to every wave here: `usable` only when at most about 1 site in 7 has no drawn road within
about 20 m and every drawn road sits on a visible one; otherwise `hold`. (The message said the brief
on main was updated; at 19:25Z origin/main didn't carry it yet. It is stricter than the brief, so
applied.)

STATUS: started
