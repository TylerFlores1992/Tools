// Which example campground the campground page shows (`?id=`), so every Explore result opens a
// page of its own. Upper Pines keeps its hand-made calendar (every CampHawk calendar state); the
// others get July and August from their open nights in explore-data, then the same later months.
// A campground whose provider didn't answer reads "couldn't check" all the way through, never
// "booked". All of it is example data.
import { CAMPGROUND, MONTHS, SITES, type Month } from "./campground-data";
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

export function campgroundFor(id: string | null): { info: CampgroundInfo; months: Record<string, Month> } {
  const c = CAMPGROUNDS.find((x) => x.id === id);
  if (!c || c.id === CAMPGROUND.id) return { info: { ...CAMPGROUND, reservable: true }, months: MONTHS };
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
  };
}
