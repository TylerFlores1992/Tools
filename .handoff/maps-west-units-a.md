# Batch west-units-a


Setup (2026-10-08): network fine (every map host answers; Geofabrik still resets, OSM France works). RIDB export of 2026-10-07 (Last-Modified Wed, 07 Oct 2026 18:46:58 GMT), the one the specs were planned on. osmium-tool needed `apt-get update` first. us-west extract (OSM as of 2026-10-07T00:17:45Z): 3.76 GB, trimmed to 3.09 GB, about 7 min.

## Wave 26 (us-west, units)
- Built 89, failed 0 (41 min; USGS water timed out on many and the build fell back to OpenStreetMap's water)
- Check: ready 75, review 14, not drawn 0
- First look: good 60, usable 6, hold 5, unsure 18
- Traced: 234345 (Star Meadows Guard Station: the lane from the end of the spur to the yard), 234403 (Girard Ridge Lookout: the last 85 m of road to the clearing). Both checked over the photo, within about 2 m.
- Split calls: none (single units)
- Held, and why (one line each):
  - 233169 Kentucky Camp: pin in an empty juniper draw; the listing's own point (2.7 km) is on the buildings.
  - 234248 Fivemile Butte Lookout: pin in unbroken forest; the listing's own point (1 km) is on a ridge-top building with a road.
  - 234247 Clear Lake Cabin Lookout: pin in unbroken forest; the listing's own point (800 m) is on a building in a clearing.
  - 234369 Hirz Mountain Lookout: pin on bare rock; a building 90 m northwest may be it.
  - 269838 Heybrook Lookout: pin on a highway pull-out (the trailhead), not the lookout.
- Anything new: the unit pin (the campsite point) is sometimes off and the listing's own point right (Kentucky Camp, Fivemile Butte, Clear Lake), the reverse of Dimond O. Five other listing points 0.4 to 3.4 km off were on nothing, and their pins on the unit. Unsure is mostly canopy (cabins under firs). Some pins sit on the drawn road beside the cabin (Camp Four and Half, 30 m) or on a trailhead (Heybrook).

## Wave 27 (us-west, units)
- Built 88, failed 0 (22 min)
- Check: ready 77, review 11, not drawn 0
- First look: good 55, usable 9, hold 9, unsure 15
- Traced: 234391 (Horse Prairie Cabin: the gravel drive from the Census road; moved once to sit within 3 m), 264411 (Green River Lake Lodge: the gravel lane from the campground road past the lodge). Both checked over the photo.
- Split calls: none (single units)
- Held, and why (one line each):
  - 234268 Cub River Guard Station: pin on an open grassy slope, nothing that could be the station.
  - 234293 Grizzly Ridge Yurt: pin in forest; the yurt plainly shows 80 m northeast at the end of the drawn loop.
  - 234359 Whitetail Cabin: pin on bare badlands; the listing's own point (10 km west) is on a building at a road end.
  - 234383 McGuire Mtn. Lookout: pin in unbroken forest, 500 m from any road; the listing's own point shows no lookout either.
  - 234404 Post Creek Guard Station: pin in burned forest, no building, 120 m from the road.
  - 234405 Forest Glen Guard Station: pin on a bare gravel flat by the highway; a building 30 m west may be it.
  - 234429 Deer Ridge Lookout: pin in unbroken forest; the listing's own point (2.7 km) is on a building in a ridge-top clearing.
  - 234609 Malad Summit Guard Station: pin in an empty field between houses; nothing plainly the station.
  - 234661 Fall River Guard Station: pin in unbroken forest; a green-roofed building 130 m west at a lane's end is likely it.
- Anything new: a winter (snow) photo at Windy Pass (234327). The same two failure modes as wave 26: the unit pin is off while the listing point is right (Whitetail, Deer Ridge), or the pin is 80 to 130 m off a building that plainly shows (Grizzly Ridge, Fall River). USGS photo requests were slow (one zoom failed twice before loading).

## Wave 28 (us-west, units)
- Built 89, failed 0 (34 min, then a full re-run of about 10 min: see below)
- Check: ready 74, review 15, not drawn 0
- First look: good 47, usable 15, hold 10, unsure 17
- Traced: 234212 (Peavy Cabin: the gravel drive from the road to the cabin's parking pad; moved once to sit on the drive's middle and join the road). Checked over the photo.
- Split calls: none (single units)
- Held, and why (one line each):
  - 232342 Holiday Group: pin on the highway's edge; neither nearby clearing is plainly the group site.
  - 233178 Shaw House: pin on an empty juniper slope 600 m from any road; the listing's own point is among several houses.
  - 233162 Gray Pine Group: pin in brush by the creek; the group area plainly shows 80 m west.
  - 234006 Harvey West Cabin: pin in unbroken forest 200 m from any road; the listing's own point is in forest too.
  - 234168 Ludlum House: pin in forest; the house plainly shows 100 m north.
  - 234294 Limber Flag Yurt: pin in unbroken forest; the listing's own point (2.2 km) is on a round structure at a road bend.
  - 234521 McCain Cabin: pin in an empty meadow; the listing's own point (860 m) is on the cabin in its yard.
  - 234531 Podunk Guard Station: pin in an empty wet meadow 110 m from any road.
  - 234570 Hoback Guard Station: pin in open grassland with no building.
  - 234582 La Barge Guard Station: pin in a wet meadow; the station plainly shows 60 m northwest.
- Anything new: **the first full build exited without writing the manifest** ("unsettled top-level await"): one campground (234522) never finished, likely a hung request. A full re-run from the cache finished all 89 and wrote it. A rebuild by id fails until the manifest exists ("a campground is missing from the manifest").

STATUS: started (wave 29 next)
