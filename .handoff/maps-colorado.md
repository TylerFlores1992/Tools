# Batch colorado


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

## Wave 35 (Colorado, units)
- Built 53, failed 0
- Check: ready 45, review 8, not drawn 0 (the 8 reviews: the listing's own point 330 m to 2.9 km from the unit's)
- First look: good 21, usable 4, hold 26, unsure 2
- Traced: 233232, 233289 (short drives to guard stations; checked over the photo after the rebuild)
- Split calls: none (single units)
- Held, and why (one line each):
  - 10165115, 10165130, 10165240, 10165255, 10165270, 10165280, 10165295, 10165330, 10165335,
    10165390, 10165440, 10165455, 10165646, 10165661, 10165686, 10165716 (16, every Pike–San Isabel /
    San Juan "Standard" listing): **a whole campground booked as one site**, its point a placeholder on
    the entrance road or a junction, not on a pad. A unit location map would mislead; these need the
    campground's own map, or a "whole campground" design. New failure mode.
  - 233804, 233805 (Lake Isabel's Ponderosa and Spruce group sites): pin in unbroken forest, 120 to 150 m from any road.
  - 233927: pin in forest 30 m from the small building that may be the guard station.
  - 233932: pin on a grassy clearing in forest, no building, 190 m from a road.
  - 233941: pin on open scrub, not on anything plainly a group tent area.
  - 233979: pin on open sagebrush, no building; the listing's own point is 1.5 km off.
  - 234129: pin in unbroken forest, no building or clearing.
  - 234211: pin in dense forest 40 m from the open group area it belongs to.
  - 234706, 234707 (Platoro cabins 1 and 2): both share one point on open grass in the village, on no building.
- Anything new: the "whole campground as one Standard site" listings above (16 of 53, about a third
  of the wave). The unit check passes them (point = listing point, road within 700 m), so only the
  photo catches them.

## Wave 36 (Colorado, units)
- Built 53, failed 0
- Check: ready 52, review 1 (234664: the listing's own point 490 m from the unit's), not drawn 0
- First look: good 2, usable 0, hold 51, unsure 0
- Traced: none (no undrawn road to a real unit)
- Split calls: none (single units)
- Held, and why (one line each):
  - 49 listings, every id 10165110 to 10165751 in this wave: **a whole campground booked as one
    "Standard" site** (the same failure mode as wave 35), its point a placeholder on the entrance
    road, a junction or inside a loop, never on a pad. The check calls them ready (the point is the
    listing's own point, and a road is close), so only the photo shows the problem. Each note says
    where the point sits.
  - 234664 (Aspen Leaf Cabin): pin on open scrub, no building; the listing's point is 490 m off.
  - 234683 (Dawson Cabin): pin among piñon, no building; the only building is 110 m away, no road.
- Anything new: with wave 35, **65 of the 106 "single units" in this batch are whole campgrounds
  (first-come or group-booked as one "Standard" site)**, not cabins. They likely belong with the
  multi-site campgrounds (built from OSM/USFS loops, with no site points) or under a "whole
  campground" design; a unit location map of them misleads. Worth a population rule: type
  STANDARD NONELECTRIC / TENT ONLY, site name "Standard", one site → not a unit.

## Summary for the orchestrator
- All four waves built (232 maps, 0 failures), looked at over the photo, and traced where the
  photo showed what's missing: 8 maps traced (232066, 232252, 232339, 234686, 232153, 273348,
  233232, 233289), 5 split calls kept (232146, 232158, 232329, 10165180, 233811), 1 dropped (234724).
- Tests: only the index-sync test fails, as expected before `lab-index.mjs`.
- Times (from the commits): setup 16:10–16:25 (extract 12 min); wave 22 build 16:25–16:34,
  first look to 17:03; wave 23 first look 17:03–17:17 (built during wave 22's look);
  wave 35 17:17–17:26; wave 36 17:26–17:35.
- Note for the final check: images stopped loading for part of wave 22's first look; I redid every
  wave-22 call from its photo once they loaded again, and re-checked each trace over the photo.
  Many wave-23 calls were made from the overview frame without a zoom (frames under 1 km).

STATUS: complete
