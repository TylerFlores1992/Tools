// A first look at every sample map over the aerial photo (USDA NAIP), by the session that built
// them (2026-10-07), so the automatic check can be judged against eyes on the ground. One look, at
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
  "270816": { call: "hold", note: "The Park Service’s roads have only the outer loop; the twelve rows inside are missing. OpenStreetMap has them (median 11 m)." },
  "252970": { call: "good", note: "Hiker-biker sites along the towpath, set back toward the river. Far from the drawn line by design." },
  "233411": { call: "hold", note: "Sites sit on visible pads, but OpenStreetMap is missing almost every loop road." },
  "233488": { call: "hold", note: "Sites sit on visible pads, but only one short loop is drawn." },
  "233595": { call: "usable", note: "Sites right; the loop under sites 06-10 and the lanes to 11-28 are missing." },
  "232544": { call: "good", note: "Roads and site spurs match the photo." },
  "10064579": { call: "usable", note: "Shore sites right; the spur to sites 1 and 2 isn’t drawn." },
  "233314": { call: "usable", note: "Sites right; the campground lane beside the highway is only partly drawn." },
  "233604": { call: "good", note: "OpenStreetMap even has each site’s driveway." },
  "234094": { call: "good", note: "Roads and sites match the photo." },
  "232603": { call: "good", note: "Both loops drawn; sites on their pads." },
  "233621": { call: "good", note: "Loops and sites match the photo." },
  "233127": { call: "good", note: "Sites at the ends of their visible spurs." },
  "234628": { call: "hold", note: "The campground lanes are missing; sites float over the grass." },
  "10244162": { call: "usable", note: "Sites 1-6 are tent pads in the trees off the loop; nothing looks wrong." },
  "251943": { call: "usable", note: "Outer loop drawn; sites to its west are under trees with no road shown." },
  "234207": { call: "usable", note: "Most loops drawn; the road to sites 10-16 is partly missing." },
  "231945": { call: "good", note: "Loops and sites match the photo." },
  "232171": { call: "hold", note: "No campground roads under the canopy; only the highway is drawn." },
  "232293": { call: "hold", note: "Three group sites spread across 770 m, one far from the others." },
  "233920": { call: "hold", note: "Sites on visible loops, but most loop roads are missing." },
  "232298": { call: "good", note: "Loops and sites match; held only because one site has no point." },
  "232340": { call: "good", note: "Loops drawn; sites along them." },
  "10274252": { call: "good", note: "Sites strung along the drawn road, as on the photo." },
  "10243253": { call: "usable", note: "Sites right; OpenStreetMap’s loop doesn’t quite follow the visible dirt roads." },
  "251724": { call: "unsure", note: "The photo is too coarse here; most sites cluster below the drawn loop." },
  "234606": { call: "good", note: "Both loops and sites match; held only because one site has no point." },
  "255177": { call: "good", note: "The cabins and lodge sit outside OpenStreetMap’s campground outline, which is right: they’re cabins." },
  "250035": { call: "usable", note: "The loop is drawn but rounder than the real road." },
  "234128": { call: "usable", note: "The outer loop is drawn; the inner lanes to the sites are missing." },
  "232908": { call: "good", note: "Roads and sites match the photo." },
  "255303": { call: "hold", note: "Several campgrounds 2 km apart under one listing. It needs a map per campground." },
  "234137": { call: "good", note: "Loop and sites match the shore." },
  "232900": { call: "good", note: "Two group sites by the road and lot." },
  "233130": { call: "good", note: "Loop and sites fit; held only because one site has no point." },
  "233713": { call: "unsure", note: "OpenStreetMap’s loop is a hand-drawn octagon, and the photo is too coarse to check the sites." },
  "123440": { call: "good", note: "Sites along the river road, as on the photo." },
  "273337": { call: "hold", note: "The campground spur is missing; sites float in the trees." },
  "232903": { call: "good", note: "Road and sites match the photo." },
  "232907": { call: "usable", note: "Sites right; the dirt loop to sites 13-15 is missing and the drawn road cuts through trees." },
  "234509": { call: "good", note: "Loop and sites match; the track to sites 3-6 isn’t drawn." },
  "233349": { call: "hold", note: "The site spurs are missing; only the forest road is drawn." },
  "231875": { call: "good", note: "Sites sit along the drawn loop." },
  "251437": { call: "usable", note: "The loop is drawn roughly, with one side cutting through trees." },
};

export const FIRST_LOOK_WORD: Record<FirstLook, string> = {
  good: "Good",
  usable: "Usable, roads incomplete",
  hold: "Not usable as drawn",
  unsure: "Can’t tell from the photo",
};
