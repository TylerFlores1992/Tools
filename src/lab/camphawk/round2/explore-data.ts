// Example data for the Explore mockup (lab only; nothing here is live or read from CampHawk).
// The story matches the other Golden hour screens: today is Mon, Jul 6, 2026, the search is
// around Yosemite Valley, and Upper Pines opens for Jul 18-21 (its nights come from the
// campground page's calendar, so the two screens can't disagree). The four campgrounds inside the
// default 10 miles show CampHawk's four result states at once: open, booked, couldn't check, and
// first come. Distances are made up but plausible; the map positions are on the illustration.
import { addDays, nightsBetween, type ISODate } from "../ui/date";
import { MONTHS, CAMPGROUND } from "./campground-data";

export type Provider = "Recreation.gov" | "ReserveCalifornia";

export interface ExampleCampground {
  id: string;
  name: string;
  place: string;
  provider: Provider;
  distance: number;
  /** false = first come, first served (no reservations, so nothing to watch). */
  reservable: boolean;
  /** true = the provider didn't answer this search: "Couldn’t check", never "booked". */
  unreadable?: boolean;
  /** Nights (check-in dates) with at least one free site. Anything else is booked. */
  openNights: ISODate[];
  siteTypes: Array<"tent" | "cabin" | "group">;
  electric: boolean;
  /** Longest pad on file, in feet; null when no site lists one. */
  maxPad: number | null;
  /** Position on the illustrated map, in % of the picture's width and height (the map crops
      it top and bottom on wider screens; see .gh-map-pin). Every pin sits on the open valley. */
  pin: { x: number; y: number };
}

const upperPinesNights = Object.values(MONTHS).flatMap((m) => Object.keys(m.open));

export const ORIGIN = "Yosemite Valley, CA";

export const CAMPGROUNDS: ExampleCampground[] = [
  { id: CAMPGROUND.id, name: "Upper Pines", place: "Yosemite Valley, CA", provider: "Recreation.gov", distance: 0.4, reservable: true, openNights: upperPinesNights, siteTypes: ["tent"], electric: false, maxPad: 35, pin: { x: 53, y: 52 } },
  { id: "north-pines", name: "North Pines", place: "Yosemite Valley, CA", provider: "Recreation.gov", distance: 0.7, reservable: true, openNights: [], siteTypes: ["tent"], electric: false, maxPad: 40, pin: { x: 59, y: 42 } },
  { id: "lower-pines", name: "Lower Pines", place: "Yosemite Valley, CA", provider: "Recreation.gov", distance: 0.6, reservable: true, unreadable: true, openNights: [], siteTypes: ["tent"], electric: false, maxPad: 40, pin: { x: 47, y: 61 } },
  { id: "camp-4", name: "Camp 4", place: "Yosemite Valley, CA", provider: "Recreation.gov", distance: 1.3, reservable: false, openNights: [], siteTypes: ["tent"], electric: false, maxPad: null, pin: { x: 40, y: 71 } },
  { id: "crane-flat", name: "Crane Flat", place: "Groveland, CA", provider: "Recreation.gov", distance: 16, reservable: true, openNights: ["2026-07-10", "2026-07-11", "2026-07-18", "2026-07-19", "2026-08-07"], siteTypes: ["tent", "group"], electric: false, maxPad: 35, pin: { x: 70, y: 37 } },
  { id: "bridalveil-creek", name: "Bridalveil Creek", place: "Yosemite National Park, CA", provider: "Recreation.gov", distance: 18, reservable: true, openNights: ["2026-07-18", "2026-07-19", "2026-07-20", "2026-07-24", "2026-07-25"], siteTypes: ["tent", "group"], electric: false, maxPad: 35, pin: { x: 34, y: 80 } },
  { id: "hodgdon-meadow", name: "Hodgdon Meadow", place: "Groveland, CA", provider: "Recreation.gov", distance: 24, reservable: true, openNights: [], siteTypes: ["tent", "group"], electric: false, maxPad: 35, pin: { x: 67, y: 16 } },
  { id: "wawona", name: "Wawona", place: "Wawona, CA", provider: "Recreation.gov", distance: 25, reservable: true, openNights: ["2026-07-27", "2026-07-28"], siteTypes: ["tent", "group"], electric: false, maxPad: 35, pin: { x: 28, y: 86 } },
  { id: "dimond-o", name: "Dimond O", place: "Groveland, CA", provider: "Recreation.gov", distance: 37, reservable: true, openNights: ["2026-07-06", "2026-07-07", "2026-07-10", "2026-07-11", "2026-07-17", "2026-07-18", "2026-07-19", "2026-07-20"], siteTypes: ["tent"], electric: true, maxPad: 40, pin: { x: 73, y: 22 } },
  { id: "calaveras-big-trees", name: "Calaveras Big Trees State Park", place: "Arnold, CA", provider: "ReserveCalifornia", distance: 92, reservable: true, openNights: ["2026-07-18", "2026-07-19", "2026-07-20", "2026-08-01"], siteTypes: ["tent", "cabin"], electric: true, maxPad: 32, pin: { x: 76, y: 45 } },
];

/** What the place box suggests: a town to search around, or a campground (Explore's two kinds). */
export const SUGGESTIONS: Array<{ kind: "place" | "campground"; name: string; sub?: string }> = [
  { kind: "place", name: "Yosemite Valley, CA" },
  { kind: "place", name: "Yosemite National Park, CA" },
  { kind: "campground", name: "Upper Pines", sub: "Yosemite Valley, CA" },
  { kind: "campground", name: "North Pines", sub: "Yosemite Valley, CA" },
  { kind: "campground", name: "Lower Pines", sub: "Yosemite Valley, CA" },
  { kind: "place", name: "Groveland, CA" },
];

export function suggest(q: string) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return SUGGESTIONS.filter((s) => [s.name, s.sub ?? ""].some((v) => v.toLowerCase().includes(needle)));
}

export interface Filters { siteType: string | null; rvLength: number | null; electric: boolean }

export interface SearchQuery {
  radius: number;
  start: ISODate | null;
  end: ISODate | null;
  /** Flexible: any run of this many nights inside start..end. */
  flexNights: number | null;
  filters: Filters;
}

/** true open · false booked · undefined couldn't check or first come (ResultCard's three answers). */
export function availability(c: ExampleCampground, q: SearchQuery): boolean | undefined {
  if (!c.reservable || c.unreadable) return undefined;
  if (!q.start || !q.end) return undefined;
  const open = new Set(c.openNights);
  const run = q.flexNights ?? nightsBetween(q.start, q.end);
  const lastStart = q.flexNights ? addDays(q.end, -run) : q.start;
  for (let s = q.start; s <= lastStart; s = addDays(s, 1)) {
    let ok = true;
    for (let i = 0; i < run && ok; i++) ok = open.has(addDays(s, i));
    if (ok) return true;
  }
  return false;
}

export function search(q: SearchQuery): Array<ExampleCampground & { hasAvailability: boolean | undefined }> {
  const { siteType, rvLength, electric } = q.filters;
  return CAMPGROUNDS
    .filter((c) => c.distance <= q.radius)
    .filter((c) => !siteType || c.siteTypes.includes(siteType as "tent"))
    .filter((c) => !electric || c.electric)
    .filter((c) => !rvLength || (c.maxPad ?? 0) >= rvLength)
    .sort((a, b) => a.distance - b.distance)
    .map((c) => ({ ...c, hasAvailability: availability(c, q) }));
}
