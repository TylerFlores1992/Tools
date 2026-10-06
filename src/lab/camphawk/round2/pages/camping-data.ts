// Example data for the lab's search pages (Tier 3: campsite-finder src/app/camping, lib/
// stateCampgrounds.ts, lib/siteTypeHubs.ts, lib/hardToBook.ts, lib/competitors.ts). CampHawk
// reads these from its catalog; the lab can't, so:
// - Real (from CampHawk's code and comments): which 47 states and 9 provinces have pages,
//   California's 875, the province counts, the yurt states and counts, the cabin total (1,145),
//   the hardest-to-book parks and their order, the competitors' one-line descriptions.
// - Illustrative (labeled on the pages): every other state count, the cabin and group splits by
//   state, and the campground names in the lists (only California's are drawn).

export const MIN_FOR_PAGE = 5;

export type Region = { code: string; name: string; slug: string; count: number; canada?: boolean };

const slug = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const r = (code: string, name: string, count: number, canada = false): Region => ({ code, name, slug: slug(name), count, canada });

/** The 47 US states with a page (HI 2, LA 1 and NJ 1 fall under the threshold). */
export const STATES: Region[] = [
  r("AL", "Alabama", 61), r("AK", "Alaska", 190), r("AZ", "Arizona", 214), r("AR", "Arkansas", 118), r("CA", "California", 875),
  r("CO", "Colorado", 402), r("CT", "Connecticut", 19), r("DE", "Delaware", 12), r("FL", "Florida", 236), r("GA", "Georgia", 141),
  r("ID", "Idaho", 312), r("IL", "Illinois", 163), r("IN", "Indiana", 47), r("IA", "Iowa", 88), r("KS", "Kansas", 74),
  r("KY", "Kentucky", 96), r("ME", "Maine", 38), r("MD", "Maryland", 44), r("MA", "Massachusetts", 27), r("MI", "Michigan", 251),
  r("MN", "Minnesota", 320), r("MS", "Mississippi", 82), r("MO", "Missouri", 197), r("MT", "Montana", 288), r("NE", "Nebraska", 41),
  r("NV", "Nevada", 109), r("NH", "New Hampshire", 33), r("NM", "New Mexico", 146), r("NY", "New York", 72), r("NC", "North Carolina", 129),
  r("ND", "North Dakota", 46), r("OH", "Ohio", 152), r("OK", "Oklahoma", 113), r("OR", "Oregon", 356), r("PA", "Pennsylvania", 81),
  r("RI", "Rhode Island", 6), r("SC", "South Carolina", 64), r("SD", "South Dakota", 77), r("TN", "Tennessee", 132), r("TX", "Texas", 197),
  r("UT", "Utah", 244), r("VT", "Vermont", 23), r("VA", "Virginia", 158), r("WA", "Washington", 341), r("WV", "West Virginia", 58),
  r("WI", "Wisconsin", 168), r("WY", "Wyoming", 196),
];

/** The 9 provinces and territories with a page (QC withheld; SK and PE under the threshold). Real counts. */
export const PROVINCES: Region[] = [
  r("AB", "Alberta", 19, true), r("BC", "British Columbia", 132, true), r("MB", "Manitoba", 45, true), r("NB", "New Brunswick", 7, true),
  r("NL", "Newfoundland and Labrador", 20, true), r("NT", "Northwest Territories", 21, true), r("NS", "Nova Scotia", 25, true),
  r("ON", "Ontario", 99, true), r("YT", "Yukon", 7, true),
];

export const ALL_REGIONS = [...STATES, ...PROVINCES];
export const regionBySlug = (s: string) => ALL_REGIONS.find((x) => x.slug === s);
export const total = (rows: Region[]) => rows.reduce((n, x) => n + x.count, 0);

export type HubSlug = "cabins" | "group-camping" | "yurts";
export type Hub = { slug: HubSlug; heading: string; label: string; noun: string; blurb: string; byRegion: Record<string, number> };

export const HUBS: Hub[] = [
  {
    slug: "cabins", heading: "Campgrounds with Cabins", label: "Campgrounds with Cabins", noun: "cabins",
    blurb: "A cabin is the hardest thing to get in most park systems: there are only ever a handful per campground, they book the day the window opens, and they stay booked through the whole season. When one comes back it is usually a cancellation, and it is usually gone within the hour.",
    // 38 states and 5 provinces, 1,145 in all (the total is CampHawk's; the split is illustrative).
    byRegion: {
      AL: 14, AK: 41, AZ: 22, AR: 31, CA: 128, CO: 52, FL: 38, GA: 35, ID: 33, IL: 21, IN: 12, IA: 18, KS: 9, KY: 29, ME: 7, MD: 11,
      MI: 44, MN: 63, MS: 16, MO: 37, MT: 38, NE: 8, NV: 6, NM: 10, NY: 24, NC: 19, OH: 34, OK: 22, OR: 49, PA: 26, SD: 15,
      TN: 27, TX: 30, UT: 17, VA: 40, WA: 36, WV: 19, WI: 28, BC: 9, MB: 6, ON: 11, NS: 5, AB: 5,
    },
  },
  {
    slug: "group-camping", heading: "Group Campsites", label: "Group Campsites", noun: "group campsites",
    blurb: "Group sites are booked further ahead than anything else — reunions, scout troops and weddings plan a year out — and there is rarely more than one or two per campground. A cancellation on a group site frees up a whole weekend for a whole party, which is why they do not sit unclaimed for long.",
    byRegion: {
      AL: 12, AZ: 41, AR: 25, CA: 168, CO: 77, FL: 34, GA: 28, ID: 55, IL: 30, KY: 19, MI: 37, MN: 49, MO: 36, MT: 46, NV: 18, NM: 24,
      NC: 22, OH: 26, OK: 21, OR: 71, SD: 13, TN: 24, TX: 33, UT: 51, VA: 29, WA: 64, WI: 31, WY: 35, BC: 12, ON: 8,
    },
  },
  {
    slug: "yurts", heading: "Yurt Camping", label: "Yurt Camping", noun: "yurts",
    blurb: "Yurts are rare on the booking sites we cover, and a park that has them usually has only a handful. They are booked solid in season and rarely show up in a normal search, because there are too few of them to stand out.",
    // Real: yurt pages exist in exactly these four states.
    byRegion: { VA: 16, UT: 8, OR: 5, CA: 5 },
  },
];
export const hubBySlug = (s: string) => HUBS.find((h) => h.slug === s);
export const regionsFor = (hub: Hub) => ALL_REGIONS.filter((x) => (hub.byRegion[x.code] ?? 0) >= MIN_FOR_PAGE).map((x) => ({ ...x, count: hub.byRegion[x.code] }));
export const hubsIn = (code: string) => HUBS.filter((h) => (h.byRegion[code] ?? 0) >= MIN_FOR_PAGE);

/** California's list, by town (an excerpt; CampHawk's runs to every town). */
export type Town = { city: string | null; campgrounds: string[] };
export const CALIFORNIA: { towns: number; providers: string[]; groups: Town[] } = {
  towns: 300,
  providers: ["Recreation.gov", "ReserveCalifornia"],
  groups: [
    { city: "Big Sur", campgrounds: ["Kirk Creek Campground", "Plaskett Creek Campground", "Pfeiffer Big Sur State Park", "Limekiln State Park", "Andrew Molera State Park"] },
    { city: "Crescent City", campgrounds: ["Jedediah Smith Campground", "Mill Creek Campground", "Florence Keller Park"] },
    { city: "Joshua Tree", campgrounds: ["Black Rock Campground", "Indian Cove Campground", "Jumbo Rocks Campground", "Cottonwood Campground"] },
    { city: "Lake Tahoe", campgrounds: ["D. L. Bliss State Park", "Emerald Bay State Park", "Fallen Leaf Campground", "Meeks Bay Campground", "Nevada Beach Campground"] },
    { city: "Malibu", campgrounds: ["Leo Carrillo State Park", "Malibu Creek State Park", "Point Mugu State Park"] },
    { city: "Mammoth Lakes", campgrounds: ["Lake Mary Campground", "Twin Lakes Campground", "Coldwater Campground", "New Shady Rest Campground"] },
    { city: "Sequoia National Park", campgrounds: ["Lodgepole Campground", "Dorst Creek Campground", "Potwisha Campground", "Buckeye Flat Campground"] },
    { city: "Yosemite National Park", campgrounds: ["Upper Pines", "Lower Pines", "North Pines", "Hodgdon Meadow", "Crane Flat", "Wawona", "Tuolumne Meadows"] },
    { city: null, campgrounds: ["Anthony Chabot Regional Park", "Butano State Park", "Patrick's Point (Sue-meg) State Park"] },
  ],
};

/** The hardest-to-book list: CampHawk's own pick, in its order (Yosemite first, on purpose). */
export const HARD_TO_BOOK: Array<{ park: string; campgrounds: string[] }> = [
  { park: "Yosemite National Park", campgrounds: ["Upper Pines", "Lower Pines", "North Pines", "Hodgdon Meadow", "Crane Flat", "Wawona"] },
  { park: "Zion National Park", campgrounds: ["Watchman Campground"] },
  { park: "Arches National Park", campgrounds: ["Devils Garden Campground"] },
  { park: "Joshua Tree National Park", campgrounds: ["Black Rock Campground"] },
  { park: "Death Valley National Park", campgrounds: ["Furnace Creek Campground"] },
  { park: "Sequoia & Kings Canyon National Parks", campgrounds: ["Lodgepole Campground", "Dorst Creek Campground"] },
  { park: "Olympic National Park", campgrounds: ["Kalaloch Campground", "Hoh Rain Forest Campground"] },
  { park: "Mount Rainier National Park", campgrounds: ["Ohanapecosh Campground"] },
  { park: "Grand Teton National Park", campgrounds: ["Jenny Lake Campground"] },
  { park: "Yellowstone National Park", campgrounds: ["Madison Campground"] },
  { park: "Glacier National Park", campgrounds: ["Many Glacier Campground"] },
  { park: "Rocky Mountain National Park", campgrounds: ["Moraine Park Campground", "Aspenglen Campground"] },
  { park: "Black Canyon of the Gunnison National Park", campgrounds: ["South Rim Campground"] },
  { park: "Grand Canyon National Park", campgrounds: ["Mather Campground", "North Rim Campground"] },
  { park: "Acadia National Park", campgrounds: ["Blackwoods Campground"] },
  { park: "Assateague Island National Seashore", campgrounds: ["Assateague Island Campground"] },
  { park: "Shenandoah National Park", campgrounds: ["Big Meadows Campground"] },
  { park: "Great Smoky Mountains National Park", campgrounds: ["Elkmont Campground", "Smokemont Campground"] },
];

export type Competitor = { slug: "campflare" | "campnab"; name: string; known: string; homepage: string };
export const COMPETITORS: Record<Competitor["slug"], Competitor> = {
  campnab: { slug: "campnab", name: "Campnab", known: "Campnab watches booked campgrounds and tells you when a site is canceled.", homepage: "https://campnab.com" },
  campflare: { slug: "campflare", name: "Campflare", known: "Campflare watches booked campgrounds and tells you when a site is canceled.", homepage: "https://campflare.com" },
};

/** Coverage CampHawk derives from its catalog (COVERAGE in lib/coverage.ts). */
export const COVERAGE = { states: 50, stateParkStates: 34, canadianProvincialSystems: 7 };

/** "A", "A and B", "A, B and C". CampHawk drops the "and" at three or more. */
export const joinAnd = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
export const joinOr = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);

/** For route files: which addresses get a page (the rest are 404s). */
export const regionSlugs = () => ALL_REGIONS.filter((x) => x.count >= MIN_FOR_PAGE).map((x) => x.slug);
export const typeRegionSlugs = (type: string) => regionsFor(hubBySlug(type)!).map((x) => x.slug);
