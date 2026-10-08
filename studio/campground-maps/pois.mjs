// Service points as the camper's map knows them (src/lab/camphawk/round2/SiteMap.tsx draws
// Restroom, Water, Dump Station, Parking Lot and a shuttle stop; Showers is kept as data).
//
// The Park Service's points layer carries every kind of point a park records: at Moraine Park
// (wave 1, 2026-10-08) 588 of them, 252 campsite markers, 153 food lockers and 49 electrical
// hookups among them, while its 32 water taps were typed "Potable Water" and nine restrooms
// "Toilet", which the map never drew. So the build keeps only these kinds, under the map's names.
// "Water Access" is a boat launch or shore access, never drinking water.
const KIND = new Map([
  ...["Restroom", "Toilet", "Vault Toilet", "Restrooms"].map((t) => [t, "Restroom"]),
  ...["Water", "Potable Water", "Drinking Water"].map((t) => [t, "Water"]),
  ...["Dump Station", "Sanitary Disposal Station"].map((t) => [t, "Dump Station"]),
  ...["Parking Lot", "Parking"].map((t) => [t, "Parking Lot"]),
  ["Bus Stop / Shuttle Stop", "Bus Stop / Shuttle Stop"],
  ["Showers", "Showers"],
]);

/** The map's name for a point's kind, or null when the map has no use for it. */
export const poiKind = (type) => KIND.get(String(type ?? "").trim()) ?? null;
