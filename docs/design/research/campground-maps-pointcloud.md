# Campground lanes under canopy, from lidar point clouds (research pilot, 2026-10-09)

*A research agent's report, checked by the orchestrating session against the images named below.
Scripts and images were kept in the session's scratchpad. The repo tool that replaces them is
`studio/campground-maps/pointcloud/` (README, "Ground from lidar point clouds").*

## The question
About 690 maps are held because tree canopy hides their lanes on the photo. The relief from the
3DEP elevation service (`maps/lidar.ts`) helped 7 of 25 in the first pilot. It failed on flat
ground, unditched dirt lanes, boulder fields, hummocky forest floor and noisy relief. Can USGS's
raw point clouds show what the smoothed elevation model can't?

## Test set
The 18 maps where the relief showed no lane. Gulpha Gorge (247559), counted separately in the
brief, is one of them.

## Results
| Result | Maps | What shows it |
|---|---|---|
| Lanes plain enough to trace: 7 | Gulpha Gorge, Greenbelt, Oak Ridge, Heber Springs, Riley Creek, Azalea, Charbonneau | Ground-return intensity; relief from points where density is high |
| Drawn roads confirmed, no other lane: 4 | Fish Creek, South Shore, Whitten Park, Deep Creek | Intensity, canopy-gap layers, relief from points |
| Partial: 3 | North Rim, Tuolumne Meadows, Watsadler | Paved lanes show; dirt lanes and tent rows don't |
| No: 3 | Porcupine Flat, Whitetail Ridge, Colonial Creek | Faint dirt lanes, or too few ground points |
| No USGS point cloud: 1 | Oak Fork | Oregon DOGAMI lidar only |

- **Gulpha Gorge:** one middle lane, not two; herringbone pull-in pads on the west lane, pads on
  the east.
- **Greenbelt:** loops A to D with every pull-in spur. The drawn D loop's outer arc is 10–20 m
  off the lane; elsewhere the drawn roads are within about 2 m.
- **Oak Ridge:** every lane and pad spur, including C23–C33, which the relief couldn't place.
- **Charbonneau:** the whole paved network, including the shoreline lane. Median distance from a
  site to the lane is 3.1 m, against 14.5 m to the drawn road.
- **Where a lane lies on a drawn road, it is a median 1–2.5 m from the line.**

## Why the 3DEP relief failed
- **It wasn't missing data.** Gulpha's older, sparser 2016 survey also shows the pads in intensity
  and in relief from points.
- **The service's elevation has about half the fine relief of a 0.5 m model from the points**
  (spread 0.065 m against 0.118 m), and it has no intensity at all.
- **Ground density is the hard limit.** Below about 1.5 ground points per m², nothing shows:
  Whitetail 0.6 (a 2017 survey); Colonial Creek 0.4 under old-growth conifer.
- **Intensity finds pavement and gravel.** Dirt lanes show only as canopy gaps, or faintly.
- **Layers that added nothing:** canopy height, understory and roughness. Roughness lights up
  creek banks.

## Not a build step
- A local-contrast lane mask covered 31–61% of the drawn roads and flagged grass and trails.
- A plain intensity threshold was clean on four maps, but at Gulpha it picked up the creek and
  highway edges instead of the inner lanes.
- So a person traces over the layers, as with the relief.

## Coverage
- **567 of the 692 hidden canopy maps have USGS point clouds** (TNM product search, one query per
  map):
  - about 392 come from dense surveys (file size per km² as a rough proxy);
  - 351 surveys date from 2019 or later.
- The 125 without are mostly in Alaska (67) and Oregon (40). For Oregon, DOGAMI's point clouds
  are public domain but weren't checked.
- **126 of the 130 approved "usable" canopy maps are covered.**

## Licence and access
- **Licence:** public domain. The AWS open-data registry lists the data as "US Government Public
  Domain". The tile metadata asks that the source agencies be acknowledged and changes described.
  Credit: "USGS 3D Elevation Program lidar point cloud (public domain)".
- **Not used:** Microsoft Planetary Computer's derived 3DEP rasters, whose licence reads
  "proprietary".
- **Access:**
  - LAZ tiles on rockyweb.usgs.gov: about 0.25 MB/s per connection, so 16 byte-range connections.
    The 17 maps were 7.1 GB in 76 minutes.
  - The Entwine tiles in `usgs-lidar-public`: fast, but the newest projects aren't there yet.
  - Processing: 8 s to 4 minutes per map.
  - Looking: 5–10 minutes per map.

## Not checked
- NOAA Digital Coast lidar and Washington DNR's lidar portal: licences not checked.
