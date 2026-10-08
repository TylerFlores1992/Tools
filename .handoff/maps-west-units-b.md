# Batch west-units-b

Waves 30, 31, 32: us-west single units (cabins, lookouts, guard stations, group sites).

## Setup
- Network: every map host answered (ridb, imagery/hydro.nationalmap.gov, tigerweb, NPS, FS, OSM API,
  services2.arcgis.com). tylerflores.dev timed out and download.geofabrik.de reset the connection;
  neither is needed for the maps (the extract comes from download.openstreetmap.fr).
- RIDB export: RIDBFullExport_V1_CSV.zip dated 2026-10-07 18:46 UTC (the same export the specs
  were planned on).
- OpenStreetMap extract: us-west from OSM France, OSM as of 2026-10-07T00:17:45Z, 3.76 GB raw,
  trimmed to 3.09 GB, MD5 ok (took about 8 minutes).
- osmium-tool needed an `apt-get update` first.
- How each unit was looked at: the aerial-check overview (1.4 km) and a 300 m zoom on the pin with
  a 10 m grid side by side, with OSM trails (dashed) drawn over both, since aerial-check and
  aerial-grid draw roads only. Every map in the wave was read that way.

STATUS: started

## Wave 30 (us-west, units)
- Built 89, failed 0. The first run hung on 234420 (Savenac Cookhouse): it never logged and the
  run never wrote the manifest; a second full run from cache built all 89.
- Check: ready 69, review 20, not drawn 0
- First look: good 44, usable 12, hold 9, unsure 24
- Traced: 232918 (Lower Fir Group Area: the paved lane on the west side of the island up to the
  pavilion)
- Split calls: none (single units)
- Held, and why (one line each):
  - 231887: pin in open juniper scrub 185 m from any drawn road, nothing at it; listing point 435 m away.
  - 231892: pin in unbroken forest 540 m from the nearest drawn road, no clearing.
  - 233221: pin on an undrawn track in a dry wash with nothing at it; listing point 2 km away.
  - 233817: the unit's point is about 895 km from the listing's own (a bad RIDB point): not the Uinta River site.
  - 234133: pin in open juniper scrub 410 m from any drawn road, nothing at it.
  - 234218: pin in floodplain forest, no clearing or lane.
  - 234573: pin in unbroken forest, no clearing; listing point 2.2 km away.
  - 238333: pin on the highway shoulder on a bare slope; the campground's loops are 150 m southwest.
  - 251899: pin in open sagebrush; the only buildings are 150 m southeast by the road junction.
- Anything new:
  - Under canopy most group sites can't be told from forest: 24 of 89 unsure, more than any
    multi-site wave. A group site in the trees has no building to find.
  - Several "review" maps fail only on the listing's own point (1 to 5.6 km off) while the photo
    plainly shows the unit at the campsite's point (234528 Cowpuncher, 234749 Glade Creek,
    234755 Berlin Flats, 234314 Meyers Creek, 233944 Jack Creek): called good with that said.
  - USGS hydro (NHD) didn't answer for many maps; the build used OSM water instead.
  - About 55 minutes for the wave (build about 40 minutes, overlapping the first look).
