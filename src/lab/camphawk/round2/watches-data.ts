// Example data for the Your watches mockup (lab only). Four watches that between them show
// CampHawk's card states: a site open and already in the Recreation.gov cart, a ReserveCalifornia
// park with tomorrow's 8am holds (one queued, two offered), an ordinary running watch with muted
// sites, and a paused one. The lab's switches then layer on the rest (a provider not responding,
// auto-cart reconnecting or signed out). Today is Mon, Jul 6, 2026, as on every Golden hour screen.
import type { ISODate } from "../ui/date";

export interface Hold { id: string; site: string; part: string; status: "offered" | "requested" }

export interface ExampleWatch {
  id: string;
  name: string;
  provider: "Recreation.gov" | "ReserveCalifornia";
  /** Parts of a park, named on the card (capped at four). */
  parts?: string[];
  start: ISODate;
  end: ISODate;
  /** Flexible: any run of this many nights inside start..end. */
  flexNights?: number;
  weekendsOnly?: boolean;
  autoCart: boolean;
  active: boolean;
  mutedSites?: number;
  /** Sites seen open right now. */
  openSites?: string[];
  /** Sites the bot put in the cart (its own record). */
  carted?: string[];
  holds?: Hold[];
}

export const WATCHES: ExampleWatch[] = [
  { id: "w-upper-pines", name: "Upper Pines", provider: "Recreation.gov", start: "2026-07-18", end: "2026-07-21", autoCart: true, active: true, openSites: ["Site 042"], carted: ["Site 042"] },
  {
    id: "w-leo", name: "Leo Carrillo State Park", provider: "ReserveCalifornia",
    parts: ["Canyon Campground (sites 1-24)", "Canyon Campground (sites 25-77)", "Beach Campground"],
    start: "2026-08-01", end: "2026-08-31", flexNights: 2, weekendsOnly: true, autoCart: false, active: true,
    holds: [
      { id: "h1", site: "042", part: "Canyon Campground (sites 25-77)", status: "requested" },
      { id: "h2", site: "017", part: "Canyon Campground (sites 1-24)", status: "offered" },
      { id: "h3", site: "B12", part: "Beach Campground", status: "offered" },
    ],
  },
  { id: "w-north-pines", name: "North Pines", provider: "Recreation.gov", start: "2026-08-14", end: "2026-08-16", autoCart: true, active: true, mutedSites: 2 },
  { id: "w-wawona", name: "Wawona", provider: "Recreation.gov", start: "2026-09-04", end: "2026-09-06", autoCart: false, active: false },
];

/** Alert history, one row per alert (not per channel). */
export const ALERTS = [
  { id: "a1", when: "Jul 6, 6:02 AM", campground: "Upper Pines", site: "Site 042", channels: ["Email", "Push", "Text"], failed: [] as string[] },
  { id: "a2", when: "Jul 2, 11:48 PM", campground: "North Pines", site: "Site 063", channels: ["Email", "Push", "Text"], failed: ["Text"] },
  { id: "a3", when: "Jun 28, 7:15 AM", campground: "Leo Carrillo State Park", site: "Site 031", channels: ["Email", "Push"], failed: [] as string[] },
];

/** NewWatchOutlook's words (campsite-finder src/lib/watch-outlook.ts): shown after creating a
    watch on a fully booked stay more than two weeks out. */
export const OUTLOOK_HEADING = "You're watching a stay that's fully booked";
export function outlookBody(leadDays: number): string {
  const weeks = Math.round(leadDays / 7);
  const when = weeks >= 2 ? `about ${weeks} weeks away` : `${leadDays} days away`;
  return `Every site for these dates is taken right now, and your trip is ${when}. An opening only happens when somebody else cancels — and most cancellations come in the last week or two before a trip, as plans firm up and refund deadlines pass. So expect it to be quiet until then. We re-check every 15 seconds and alert you the moment a site frees up.`;
}
