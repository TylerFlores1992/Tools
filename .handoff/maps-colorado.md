# Batch colorado

STATUS: started

Setup: RIDB export of 2026-10-07 (files dated 2026-10-07 18:45). OSM extract us-west/colorado from
download.openstreetmap.fr, OSM as of 2026-10-07T00:09:35Z (0.41 GB, trimmed to 0.29 GB, about 12 min).
Network: every map host answered; Geofabrik resets the connection, as the playbook says (not needed).
`osmium-tool` needed `apt-get update` first.

## Wave 22 (Colorado, multi)
- Built 63, failed 0
- Check: ready 42, review 21, not drawn 0 (after traces and split calls)
- First look: good 29, usable 25, hold 8, unsure 1
- Traced: 232066, 232252, 232339, 234686 (each checked over the photo after the rebuild)
- Split calls: 232146 (bench loops and group loop across the canyon), 232158 (campground and group site 800 m down the valley), 232329 (two loops 500 m apart)
- Held, and why (one line each):
  - 231849: east sites 024 to 031 have no road, and the loop drawn round 021 to 023 follows nothing visible.
  - 231857: Census roads cut through the forest where nothing shows; 001 to 004 sit among them.
  - 231864: one site's point 260 km from the rest; frame unusable.
  - 232364: one site's point about 870 km from the rest; frame unusable.
  - 233281: under pines, drawn roads are angular lines that don't follow the lanes; middle sites have no road.
  - 233720: only the highway drawn; most sites under the trees with no visible lane.
  - 234648: several loops reuse the same site numbers (001 to 017 four times); coarse loops under pines.
  - 234794: about half the sites have no road (lanes north and the south loop show, undrawn).
- Anything new: **a bad RIDB point far from the rest (231864, 232364) isn't dropped by the outlier
  rule**: the build shows the listing as areas and the frame spans hundreds of km. Both are held.
  The National Park Service maps (232462, 234052, 260552, 233187) draw only each loop's outer road,
  so inner or outer ring lanes are missing; called usable.
  Note: images briefly stopped loading mid-wave; every map's call was redone from its photo after.

## Wave 23 (Colorado, multi)
- Built 63, failed 0
- Check: ready 47, review 15, not drawn 1 (10122789: 42% of sites share a spot)
- First look: good 30, usable 20, hold 9, unsure 4
- Traced: 232153, 273348 (each checked over the photo after the rebuild; 273348 moved about 6 m onto the lane's middle)
- Split calls: 10165180 (three groups strung 1 km along the creek), 233811 (two loops 400 m apart). 234724's call (group site across the lake) was tried and dropped: the area rules keep a single-site area with the main one, so the test failed.
- Held, and why (one line each):
  - 10122789: sites sit in neat grid rows across an open lot (not drawn by the check either).
  - 10165180: north loop drawn as an angular outline 10 to 20 m off the visible lane; split listing.
  - 10165435: angular roads cut through the pines beside the visible lanes.
  - 10168487: north part drawn as one big angular outline; sites 4 to 20 on no visible lane.
  - 10317346: the only road drawn (Census) runs through the trees where none shows; the visible lane isn't drawn.
  - 232152: a long road drawn down an open meadow where nothing shows, and a line west of the trees with no lane.
  - 232155: Census loops are angular lines through dense spruce in canyon shadow.
  - 233880: Census road zigzags through brush; the lanes to the two group shelters aren't drawn.
  - 234684: only the road above is drawn; no site has a road.
- Anything new: Census (TIGER) roads often come out as angular outlines that don't follow anything
  (10317346, 232155, 233880); OpenStreetMap does the same in a few (10165435, 10168487).
