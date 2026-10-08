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

STATUS: started
