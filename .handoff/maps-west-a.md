# Batch west-a

Waves 3, 4, 5 (us-west, multi). Branch wip/maps-west-a.

## Setup (2026-10-08)
- Network: every host in playbook §3.4 answered (200/301) except download.geofabrik.de (connection reset, as known; not needed: the extract comes from openstreetmap.fr).
- RIDB export: RIDBFullExport_V1_CSV.zip, files dated 2026-10-07 (the same export the specs were planned on).
- osmium-tool 1.16.0 from apt (needed `apt-get update` first).
- OSM extract us-west: OSM as of 2026-10-07T00:17:45Z, 3.76 GB raw, MD5 ok, trimmed to 3.09 GB. Took about 5 minutes.

STATUS: started
