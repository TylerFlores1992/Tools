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
