# Batch west-b

Waves 6, 7, 8 (us-west, multi). Branch `wip/maps-west-b`.

## Setup (2026-10-08)
- Network probe: every map host answers (ridb, imagery/hydro.nationalmap, tigerweb, services2.arcgis,
  tylerflores.dev 200; nps, fs.usda, api.openstreetmap 301). Geofabrik resets as known; the extract
  comes from openstreetmap.fr.
- RIDB export: files dated 2026-10-07 18:45 (same export the specs were planned on).
- osmium-tool 1.16.0 installed (needed `apt-get update` first).
- OSM extract us-west: OSM as of 2026-10-07T00:17:45Z.

STATUS: started
