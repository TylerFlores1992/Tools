// Which example campground the campground page shows (`?id=`), so every Explore result opens a
// page of its own. Upper Pines keeps its hand-made calendar (every CampHawk calendar state); the
// others get July and August from their open nights in explore-data, then the same later months.
// A campground whose provider didn't answer reads "couldn’t check" all the way through, never
// "booked". All of it is example data.
import { CAMPGROUND, MONTHS, SITES, type Month, type Site } from "./campground-data";
import { CAMPGROUNDS } from "./explore-data";

const ABOUT: Record<string, string> = {
  "north-pines": "A wooded campground near the Merced River on the valley floor, with views of Half Dome. Food lockers at every site.",
  "lower-pines": "A small campground on the valley floor along the Merced River, close to the Mirror Lake trail.",
  "camp-4": "A walk-in campground at the base of the granite walls, long a gathering place for climbers. Sites are shared, six people to a site.",
  "crane-flat": "A forested campground above the valley, near the Tuolumne Grove of giant sequoias.",
  "bridalveil-creek": "A quiet high-country campground on Glacier Point Road, cooler than the valley in summer.",
  "hodgdon-meadow": "A campground near the Big Oak Flat entrance, open most of the year.",
  wawona: "A riverside campground in the south of the park, a short drive from the Mariposa Grove.",
  "dimond-o": "A national forest campground along the Middle Fork of the Tuolumne River, just outside the park.",
  "calaveras-big-trees": "A state park campground among giant sequoias, with cabins and a river close by.",
};

export type CampgroundInfo = typeof CAMPGROUND & { reservable: boolean };
type Lookup = { info: CampgroundInfo; months: Record<string, Month>; sites: Record<string, Site> };

// A ReserveCalifornia campground for the site-map lab (not in Explore's example list). Its
// sites are real RC units on their real loops (RC's own area names); the openings are example
// data, Upper Pines' calendar moved onto these site numbers.
const JED_SITES: Record<string, Site> = {
  "7": { id: "7", name: "Site 7", loop: "Main Loop", type: "campsite" },
  "33": { id: "33", name: "Site 33", loop: "Main Loop", type: "campsite" },
  "48": { id: "48", name: "Site 48", loop: "Outer Loop", type: "campsite" },
  "84": { id: "84", name: "Site 84", loop: "Outer Loop", type: "campsite" },
  "92": { id: "92", name: "Site 92", loop: "Main Loop", type: "campsite" },
  "101": { id: "101", name: "Site 101", loop: "Main Loop", type: "campsite" },
  "A": { id: "A", name: "Site A", loop: "Outer Loop", type: "tent only, walk-in" },
};
const UPPER_TO_JED: Record<string, string> = { "009": "7", "042": "33", "063": "48", "088": "84", "101": "101", "117": "92", "130": "A" };
const JEDEDIAH: Lookup = {
  info: {
    ...CAMPGROUND,
    id: "jedediah-smith",
    name: "Jedediah Smith Campground",
    place: "Jedediah Smith Redwoods State Park, CA",
    stateName: "California",
    provider: "ReserveCalifornia",
    autoCart: false,
    description: "An old-growth redwood campground on the Smith River, with sites tucked among the trees on two loops and a short walk to the river beach.",
    amenities: ["Flush toilets", "Showers", "Drinking water", "Dump station", "Fire rings", "Picnic tables"],
    reservable: true,
  },
  months: Object.fromEntries(Object.entries(MONTHS).map(([m, v]) => [m, { ...v, open: Object.fromEntries(Object.entries(v.open).map(([d, ids]) => [d, ids.map((i) => UPPER_TO_JED[i])])) }])),
  sites: JED_SITES,
};

export function campgroundFor(id: string | null): Lookup {
  if (id === JEDEDIAH.info.id) return JEDEDIAH;
  const c = CAMPGROUNDS.find((x) => x.id === id);
  if (!c || c.id === CAMPGROUND.id) return { info: { ...CAMPGROUND, reservable: true }, months: MONTHS, sites: SITES };
  const siteIds = Object.keys(SITES);
  const monthOf = (m: string): Month => {
    if (c.unreadable) return { open: {}, unknown: true };
    const nights = c.openNights.filter((n) => n.startsWith(m));
    return { open: Object.fromEntries(nights.map((n) => [n, [siteIds[Number(n.slice(8)) % siteIds.length]]])) };
  };
  return {
    info: {
      ...CAMPGROUND,
      id: c.id,
      name: c.name,
      place: c.place,
      provider: c.provider,
      autoCart: c.provider === "Recreation.gov",
      description: ABOUT[c.id] ?? CAMPGROUND.description,
      reservable: c.reservable,
    },
    months: {
      "2026-07": monthOf("2026-07"),
      "2026-08": monthOf("2026-08"),
      "2026-09": c.unreadable ? { open: {}, unknown: true } : MONTHS["2026-09"],
      "2026-10": c.unreadable ? { open: {}, unknown: true } : MONTHS["2026-10"],
      "2026-11": c.unreadable ? { open: {}, unknown: true } : MONTHS["2026-11"],
    },
    sites: SITES,
  };
}
