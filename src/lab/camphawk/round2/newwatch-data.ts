// Example data for the New watch mockup (lab only). Campgrounds the picker can find, with the
// shapes CampHawk's picker has to handle: single campgrounds, parks with several bookable parts
// (one watch covers the park), a mixed park whose first-come part is left out, and a first-come
// campground that can't be picked at all. Sites are what the mute list offers.
import { CAMPGROUND, SITES } from "./campground-data";
import type { Provider } from "./explore-data";

export interface Division { id: string; name: string; reservable: boolean }
export interface Pickable {
  id: string;
  name: string;
  place: string;
  provider: Provider;
  reservable: boolean;
  divisions?: Division[];
}

export const PICKABLE: Pickable[] = [
  { id: CAMPGROUND.id, name: "Upper Pines", place: "Yosemite Valley, CA", provider: "Recreation.gov", reservable: true },
  { id: "north-pines", name: "North Pines", place: "Yosemite Valley, CA", provider: "Recreation.gov", reservable: true },
  { id: "lower-pines", name: "Lower Pines", place: "Yosemite Valley, CA", provider: "Recreation.gov", reservable: true },
  { id: "camp-4", name: "Camp 4", place: "Yosemite Valley, CA", provider: "Recreation.gov", reservable: false },
  {
    id: "leo-carrillo", name: "Leo Carrillo State Park", place: "Malibu, CA", provider: "ReserveCalifornia", reservable: true,
    divisions: [
      { id: "leo-canyon-a", name: "Canyon Campground (sites 1⁠–⁠24)", reservable: true },
      { id: "leo-canyon-b", name: "Canyon Campground (sites 25⁠–⁠77)", reservable: true },
      { id: "leo-beach", name: "Beach Campground", reservable: true },
    ],
  },
  {
    id: "carpinteria", name: "Carpinteria State Beach", place: "Carpinteria, CA", provider: "ReserveCalifornia", reservable: true,
    divisions: [
      { id: "carp-anacapa", name: "Anacapa", reservable: true },
      { id: "carp-santa-cruz", name: "Santa Cruz", reservable: true },
      { id: "carp-santa-rosa", name: "Santa Rosa", reservable: true },
      { id: "carp-san-miguel", name: "San Miguel (walk-up)", reservable: false },
    ],
  },
];

/** A subscriber's favorites: they show first when the box is empty. */
export const FAVORITE_IDS = [CAMPGROUND.id, "leo-carrillo"];

export const bookableParts = (p: Pickable) => (p.divisions ?? []).filter((d) => d.reservable);
/** Can this row lead anywhere? A park counts if any part takes reservations. */
export const pickable = (p: Pickable) => (p.divisions?.length ? bookableParts(p).length > 0 : p.reservable);

export function findCampgrounds(q: string): Pickable[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return PICKABLE.filter((p) => [p.name, p.place].some((v) => v.toLowerCase().includes(needle)));
}

export interface MuteSite { id: string; name: string; note: string }

/** The sites a watch on these campgrounds could alert about. */
export function sitesFor(ids: string[], divisions: Division[]): MuteSite[] {
  if (ids.length === 1 && ids[0] === CAMPGROUND.id) return Object.values(SITES).map((s) => ({ id: s.id, name: s.name, note: `${s.loop}, ${s.type}` }));
  return ids.flatMap((id, di) => {
    const part = divisions.find((d) => d.id === id);
    return Array.from({ length: 4 }, (_, i) => {
      const n = di * 24 + i * 5 + 3;
      return { id: `${id}-${n}`, name: `Site ${String(n).padStart(3, "0")}`, note: part ? part.name : "Loop A" };
    });
  });
}
