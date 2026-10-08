# Batch west-d

Setup (2026-10-08): network fine for every map host; Geofabrik resets as documented (extracts
come from openstreetmap.fr). RIDB export dated 2026-10-07 (same as the specs). osmium needed
`apt-get update` first. us-west extract: 3.76 GB at about 0.7 MB/s (curl reset 4 times and
resumed), MD5 ok, trimmed to 3.09 GB; OSM as of 2026-10-07T00:17:45Z. About 2 h in all.

## Wave 12 (us-west, multi)
- Built 95, failed 0
- Check: ready 61, review 29, not drawn 5 (after traces)
- First look: good 23, usable 23, hold 25, unsure 24 (8 usable calls moved to hold under the
  orchestrator's clarified bar: 233364, 233793, 233798, 233916, 251883, 232307, 233685, 234096)
- Traced: 10243267, 232335, 233154, 233537, 251883 (each checked over the photo after the rebuild;
  Lone Pine and Elks Flat traced a second time to bring them onto the road)
- Split calls: 233154 (family loop and group area, 1.1 km apart). 10317439 and 272097 were shown
  as areas by the build already (no call needed).
- Held, and why (one line each):
  - 10206584, 10206603, 10206616, 10206646 (BLM Salmon): not drawn; every site is listed twice
    ("Site #N" and "Site #N Extra Vehicle" on one point). The points and roads look right: dropping
    the "Extra Vehicle" twins would likely make all four drawable.
  - 232068: not drawn; both sites on one spot at a group building.
  - 10317439: split over 31 km, no roads in any area.
  - 272097: split; area 1's sites have no road into them.
  - 233154: group area pin on a burned slope, the drawn road there doesn't follow the visible one.
  - 233153, 233728, 233732, 232246: sites far off any drawn road under canopy, nothing to trace.
  - 234289, 234460: group sites 60 to 120 m off the visible camp.
  - 234400: Forest Service lanes don't follow the visible dirt lanes.
  - 234546: Census roads under canopy, many sites 30 to 80 m off.
  - 238331: the three group sites sit on the highway itself.
  - 233364: drawn loop 10 m off the visible one at the bottom bend.
  - 233793, 233685, 234096, 251883: a third or more of the sites have no drawn road.
  - 233798, 233916, 232307: one or both of two sites have no road.
- Anything new: "Extra Vehicle" twin sites (a stacked-point failure mode with a clear fix);
  a RIDB site literally named "This site should be deleted" (233360). USGS water sometimes didn't
  answer and the build used OpenStreetMap's water instead (it says so in the log).
