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

## Wave 31 (us-west, units)
- Built 88, failed 0 (first run, about 45 minutes, alongside wave 30's look)
- Check: ready 57, review 31, not drawn 0 (after the traces; 62 and 26 before them)
- First look: good 37, usable 18, hold 13, unsure 20
- Traced: 10176099 (Burgdorf: drive to the ranger house), 231845 (Hidden Valley: dirt road up to
  the pad), 232401 (Elk Creek Cabins: the gravel road through the station, x -400..400 m only),
  233096 (Hirz Bay Group 1: lane down the bare strip), 234532 (Jones Corral: track to the station)
- Split calls: none (single units)
- Held, and why (one line each):
  - 10165535 (Piety Island): pin in open water 80 m off the island.
  - 231964: pin on a ranch compound, not a campground; listing point 29 km away.
  - 232351: pin in juniper scrub 85 m from any road, no corral or pad; listing point 480 m away.
  - 232765: pin on the lake's drawdown flats 180 m from any road, nothing at it.
  - 233097: pin on a wooded slope 135 m from any road, nothing at it.
  - 233161: pin in a burned stand 170 m from any road, nothing at it.
  - 233820: pin in unbroken forest 225 m from any road.
  - 234000: pin in pinyon scrub, nothing at it; listing point 1.7 km away.
  - 234466: pin in unbroken forest; the drawn loop beside it crosses trees where no road shows.
  - 234771: pin in open pasture with no building; buildings are 100 m south.
  - 251579: pin on an open slope with no building; listing point 1.7 km away.
  - 273375: pin in burned forest 50 m from the drawn loop, whose own clearing is the likely camp.
  - 273378 (Hirz Cabin): pin on bare ground with no building.
- Anything new:
  - Units whose pin sits beside, not on, the plain unit (234147 last wave, 233945, 234443 here)
    were called usable: a pin 15-40 m off a building isn't wrong enough to hold.
  - 233996 (Jarvies boat-in group) has no road by design: usable, not hold.
  - Pairs of listings with pins 50 m apart in the same featureless stand (233233/233234
    Treasure Park East/North) are both unsure.
  - About 25 minutes for the look and traces.

## Wave 32 (us-west, units)
- Built 89, failed 0 (one run, about 45 minutes)
- Check: ready 80, review 9, not drawn 0 (after the trace; 81 and 8 before it)
- First look: good 12, usable 32, hold 37, unsure 8
- Traced: 234631 (Lodgepole Guard Station: the gravel drive from the road into the station's yard)
- Split calls: none
- Held, and why (one line each). 26 of the 37 are whole campgrounds listed with one generic
  "Standard" site (see below) whose one point is not on the campground:
  - 10165105, 10165305, 10314707: the generic site in unbroken forest, no campground near.
  - 10165155, 10165165, 10165205, 10165375, 10165385, 10165430, 10165495, 10165581, 10165626,
    10165656, 10165721, 10191065, 10191075, 10191090, 10191100, 10192067, 10221637, 10221647,
    10221657, 10221667, 10221677, 10215904: the generic site 20-350 m off the campground (in the
    trees, across the creek or highway, on a slope, in a meadow).
  - 10165596, 10165606: the generic site in the river / the lake.
  - 10116518: pin in open forest with no building; the guard station isn't plain anywhere near.
  - 118990: pin in sagebrush; the station's buildings are 110 m south.
  - 232348: pin in the trees of a parking island; no chalet.
  - 232790: pin on a hillside above a housing tract, 130 m from any road; listing point 640 m away.
  - 233126: pin on a forested slope 130 m from any road, no lookout or cabin.
  - 233183: pin on grass 200 m from the campground's loops and buildings.
  - 233988: pin in unbroken forest across the river, 180 m from any road.
  - 234157: pin in forest; the cabin plainly shows 70 m south on the drawn trail.
  - 234160: pin in a burned stand 315 m from any road, no cabin.
  - 234161: pin on a brushy slope 300 m below the road, no lookout.
- Anything new: **wave 32 is mostly not single units.** 50 of its 89 listings are whole
  campgrounds (Sawtooth, Boise, Mendocino, Willamette, Tonto, San Bernardino NFs and others) that
  RIDB lists with one campsite named "Standard" and no point of its own, so the build places it at
  the listing's point and calls the listing a unit. The unit check passes them ("ready": point
  within 300 m of itself, a road within 700 m), so the check's 80 ready says nothing for these.
  Where the point sits inside the campground I called it usable ("marks the campground but no
  site", 23); where it sits off it, hold (26); one unsure. None of the 50 is a site map, and a
  location pin is the most they can be. The orchestrator may want to re-plan these as multi-site
  campgrounds with no campsite points (they can't be drawn from RIDB) rather than units.
  Two more bad listing points (10038994: 1,690 km; 231968: 86 km) and one 97 km (10165285).

## Timing
- Setup (npm, RIDB, extract): about 15 minutes.
- Wave 30: about 55 minutes. Wave 31: about 25 minutes of look and traces (built alongside 30).
- Wave 32: about 50 minutes (built alongside 31's look).

STATUS: complete
