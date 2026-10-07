// A first look at every sample map over the aerial photo (USDA NAIP), by the session that built
// them (2026-10-07), so the automatic check can be judged against eyes on the ground. Updated the
// same evening after the road source was picked by fit and missing roads were traced: the 20 maps
// that changed were looked at again, and their notes say what was drawn and what's still missing. One look, at
// 0.6-1 m imagery: under tree cover a site's pad can't be seen, so "good" there means nothing
// looked wrong, not that every point was confirmed. The owner's own decisions are separate (the
// review page's Approve / Keep hidden, saved in their browser).
//
//   good   sites on real pads, roads on real roads
//   usable sites right, but some campground roads are missing or rough
//   hold   not usable as drawn (roads missing, or not one campground)
//   unsure the photo can't settle it

export type FirstLook = "good" | "usable" | "hold" | "unsure";

export const FIRST_LOOK: Record<string, { call: FirstLook; note: string }> = {
  "274721": { call: "hold", note: "The campground loop is under the trees and missing; only the highway is drawn." },
  "10227416": { call: "hold", note: "Dispersed camping areas spread over 8 km, not one campground. It needs a map per area." },
  "232471": { call: "good", note: "Three walk-in group sites by their shelters, off the parking lot. Far from a road because they’re walk-in." },
  "10085626": { call: "good", note: "Roads follow the real loops; sites sit on visible pads." },
  "252969": { call: "good", note: "Sites line the river road, as on the photo." },
  "272247": { call: "usable", note: "Two primitive sites under trees. Nothing looks wrong, but the photo can’t confirm them." },
  "270816": { call: "good", note: "Now drawn from OpenStreetMap, whose roads fit best: all twelve inner rows, matching the photo. (Was: only the Park Service’s outer loop.)" },
  "252970": { call: "good", note: "Hiker-biker sites along the towpath, set back toward the river. Far from the drawn line by design." },
  "233411": { call: "usable", note: "Census roads now draw the main loops, and the middle lane and the south section’s lanes are traced from the photo. The north loop (sites 01-13) and the lanes to 40-48 are under trees and still missing." },
  "233488": { call: "usable", note: "Census roads now draw all three loops, within a few metres of the visible roads. Only the short site spurs are missing." },
  "233595": { call: "good", note: "The loop past sites 07-10, the lane to 14, 15 and 19, and the lot past 20-28 are traced; sites sit on visible pads." },
  "232544": { call: "good", note: "Roads and site spurs match the photo." },
  "10064579": { call: "good", note: "Census roads add the shore road, and the loop to sites 6-8, the lane to 5 and the lot at 3-4 are traced. Sites 1 and 2 are under trees." },
  "233314": { call: "good", note: "The west lane to site 10 is traced; the other sites sit on open ground inside the loop road." },
  "233604": { call: "good", note: "OpenStreetMap even has each site’s driveway." },
  "234094": { call: "good", note: "Roads and sites match the photo." },
  "232603": { call: "good", note: "Both loops drawn; sites on their pads." },
  "233621": { call: "good", note: "Loops and sites match the photo." },
  "233127": { call: "good", note: "Sites at the ends of their visible spurs." },
  "234628": { call: "unsure", note: "Two paved pull-ins are traced. No lanes to the sites are visible, though Recreation.gov allows a 20 ft vehicle at each, so cars may park on the lawn." },
  "10244162": { call: "good", note: "The tracks to sites 007-009 are traced; 001-006 are tent pads in the trees south of the loop." },
  "251943": { call: "usable", note: "Outer loop drawn; sites to its west are under trees with no road shown." },
  "234207": { call: "usable", note: "Most loops drawn; the road to sites 10-16 is partly missing." },
  "231945": { call: "good", note: "Loops and sites match the photo." },
  "232171": { call: "unsure", note: "Now drawn from the Forest Service’s roads, which pass along most sites. It’s under full canopy, and sites 031, 034, 044, 046 and 048 sit inside the loop, likely on a lane no source has." },
  "232293": { call: "hold", note: "Three group sites spread across 770 m, one far from the others." },
  "233920": { call: "usable", note: "The Forest Service’s lanes draw the north loops; the south section’s sand roads are traced. A few lanes near sites 136-140 are under trees." },
  "232298": { call: "good", note: "Loops and sites match; held only because one site has no point." },
  "232340": { call: "good", note: "Now drawn from the Forest Service’s roads, which follow the visible gravel loops; the west lane runs about 10 m east of the real one by sites 055-059." },
  "10274252": { call: "good", note: "Sites strung along the drawn road, as on the photo." },
  "10243253": { call: "good", note: "Every road is traced from the photo, replacing OpenStreetMap’s, which sat up to 20 m off the visible dirt roads." },
  "251724": { call: "unsure", note: "The Forest Service’s loop runs exactly through the site points, as if one was drawn from the other. The leafless forest in the photo can’t confirm either." },
  "234606": { call: "good", note: "Both loops and sites match; held only because one site has no point." },
  "255177": { call: "good", note: "The cabins and lodge sit outside OpenStreetMap’s campground outline, which is right: they’re cabins." },
  "250035": { call: "usable", note: "The road down past site 20 is traced; the loop is drawn a little rounder than the real road." },
  "234128": { call: "good", note: "The paved spurs to sites 01-13 are traced; tent sites T1-T5 are walk-in sites on the grass." },
  "232908": { call: "good", note: "Roads and sites match the photo." },
  "255303": { call: "hold", note: "Several campgrounds 2 km apart under one listing. It needs a map per campground." },
  "234137": { call: "good", note: "Loop and sites match the shore." },
  "232900": { call: "good", note: "Two group sites by the road and lot." },
  "233130": { call: "good", note: "Loop and sites fit; held only because one site has no point." },
  "233713": { call: "unsure", note: "Now drawn from the Forest Service’s loop, under dense forest; the photo can’t confirm it." },
  "123440": { call: "good", note: "Sites along the river road, as on the photo." },
  "273337": { call: "usable", note: "The road from the lot past site 5, and the lane past sites 2 and 3, are traced. The lanes to 1, 4 and 7 aren’t visible." },
  "232903": { call: "good", note: "Road and sites match the photo." },
  "232907": { call: "usable", note: "The lanes to sites 13 and 14 are traced; the loop past 001-012 is under trees, where the drawn road can’t be checked." },
  "234509": { call: "good", note: "Loop and sites match; the track to sites 3-6 isn’t drawn." },
  "233349": { call: "good", note: "Now drawn from the Forest Service’s roads: the loop follows the visible gravel loop, with sites along it." },
  "231875": { call: "good", note: "Sites sit along the drawn loop." },
  "251437": { call: "usable", note: "The spurs to sites 008, 011, 012 and 014 are traced; the loop itself is under trees." },
};

export const FIRST_LOOK_WORD: Record<FirstLook, string> = {
  good: "Good",
  usable: "Usable, roads incomplete",
  hold: "Not usable as drawn",
  unsure: "Can’t tell from the photo",
};
