// Matching ReserveCalifornia's bookable units to California State Parks' campsite points.
// Pure, so it's tested (scripts/campground-maps-match.test.mts).

const norm = (s) => String(s ?? "").trim().toUpperCase().replace(/^0+(?=\d)/, "");
const isCabin = (t) => /cabin/i.test(t ?? "");

/**
 * units: [{ name: "Cabin (6 People) #J24", code: "J24", loop }]
 * points: State Parks GeoJSON features (properties.SITE_NBR, SITE_TYPE, CampgroundName).
 * Returns the units drawn (with their point), and what was left off and why:
 * - a unit with no point, or with two (State Parks recorded the number twice): never guessed,
 *   because a wrong site is worse than a missing one;
 * - hike-in and boat-in units: they sit away from the campground's roads.
 * Kinds must agree: RC's cabin "J24" is State Parks' cabin "24", never campsite 24. Points in a
 * separate hike-and-bike area are not the campground's sites (both have an "A" at Jedediah Smith).
 */
export function matchUnits(units, points) {
  const matched = [], notFound = [], dupes = [], skipped = [];
  for (const u of units) {
    if (/hike.?in|boat.?in/i.test(u.name)) { skipped.push(u.name); continue; }
    const cabin = isCabin(u.name);
    const key = cabin ? norm(String(u.code).replace(/^[A-Z]+/i, "")) : norm(u.code);
    const cands = points.filter((f) => norm(f.properties.SITE_NBR) === key && isCabin(f.properties.SITE_TYPE) === cabin && !/hike|bike/i.test(f.properties.CampgroundName ?? ""));
    if (cands.length === 1) matched.push({ unit: u, f: cands[0] });
    else (cands.length ? dupes : notFound).push(u.name);
  }
  return { matched, notFound, dupes, skipped };
}

/** "Tent, Non-elect, std" → "TENT NONELECTRIC" (the shape the lab's type label reads). */
export const typeOf = (t) => String(t ?? "").replace(/non-?elect\w*/i, "nonelectric").replace(/\belect\w*/i, "electric").replace(/,?\s*std\b/i, "").replace(/,/g, "").replace(/\s+/g, " ").trim().toUpperCase();
