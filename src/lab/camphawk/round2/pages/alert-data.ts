// Example data for the "after an alert" screens (Tier 1). Same story as the rest of the lab:
// today is Mon, Jul 6, 2026. Upper Pines (Recreation.gov) has site 042 open for Jul 18-21 and
// in your cart; Leo Carrillo (ReserveCalifornia) releases canceled sites at 8 AM tomorrow, with
// one hold queued and two offered. Nothing here is live.
//
// Release times: CampHawk writes one 8am release three ways ("8 AM", "Sep 4 at 08:00 PT",
// "2026-09-04 08:00"). The lab says it one way everywhere: releaseShort / releaseLong.

export const RELEASE = { date: "2026-07-07", time: "08:00" };
export const releaseShort = () => "8 AM";
export const releaseLong = () => "Tue, Jul 7 at 8 AM PT";
export const releaseTomorrow = () => "tomorrow at 8 AM";

export type ManageWatch = {
  id: string;
  name: string;
  provider: "Recreation.gov" | "ReserveCalifornia";
  parts?: string[];
  /** The part the representative id points at (muting covers it only, in CampHawk). */
  firstPart?: string;
  start: string;
  end: string;
  flexNights?: number;
  weekendsOnly?: boolean;
  autoCart: boolean;
  muted: number;
  open: Array<{ id: string; name: string; seenSecondsAgo: number }>;
  requested: Array<{ unit: string; release: string; stay: string }>;
  offered: Array<{ unit: string; nights: number; from: string }>;
  alerts: Array<{ when: string; channel: "Text" | "Email" | "App notification"; failed?: boolean; site?: string }>;
  sites: Array<{ id: string; name: string; note: string; alerted?: boolean }>;
};

export const MANAGE: Record<"upper-pines" | "leo", ManageWatch> = {
  "upper-pines": {
    id: "w-upper-pines",
    name: "Upper Pines",
    provider: "Recreation.gov",
    start: "2026-07-18",
    end: "2026-07-21",
    autoCart: true,
    muted: 2,
    open: [{ id: "042", name: "Site 042", seenSecondsAgo: 40 }],
    requested: [],
    offered: [],
    alerts: [
      { when: "Jul 6, 6:02 AM", channel: "Text", site: "Site 042" },
      { when: "Jul 6, 6:02 AM", channel: "Email", site: "Site 042" },
      { when: "Jul 2, 11:48 PM", channel: "App notification", failed: true },
    ],
    sites: [
      { id: "042", name: "Site 042", note: "open now · standard nonelectric", alerted: true },
      { id: "009", name: "Site 009", note: "Standard nonelectric" },
      { id: "063", name: "Site 063", note: "RV nonelectric" },
      { id: "088", name: "Site 088", note: "Standard nonelectric" },
      { id: "101", name: "Site 101", note: "Standard nonelectric" },
      { id: "117", name: "Site 117", note: "Standard nonelectric" },
      { id: "130", name: "Site 130", note: "Standard nonelectric" },
    ],
  },
  leo: {
    id: "w-leo",
    name: "Leo Carrillo State Park",
    provider: "ReserveCalifornia",
    parts: ["Canyon Campground (sites 1⁠–⁠24)", "Canyon Campground (sites 25⁠–⁠77)", "Beach Campground"],
    firstPart: "Canyon Campground (sites 1⁠–⁠24)",
    start: "2026-08-01",
    end: "2026-08-31",
    flexNights: 2,
    weekendsOnly: true,
    autoCart: false,
    muted: 0,
    open: [],
    requested: [{ unit: "Site 042", release: "8 AM", stay: "Aug 8–10 · 2 nights" }],
    offered: [
      { unit: "Site 017", nights: 2, from: "Aug 1" },
      { unit: "Site B12", nights: 2, from: "Aug 8" },
    ],
    alerts: [{ when: "Jun 28, 7:15 AM", channel: "Email", site: "Site 031" }],
    sites: [
      { id: "017", name: "Site 017", note: "Canyon Campground (sites 1⁠–⁠24)" },
      { id: "021", name: "Site 021", note: "Canyon Campground (sites 1⁠–⁠24)" },
      { id: "031", name: "Site 031", note: "Canyon Campground (sites 25⁠–⁠77) · alerted before", alerted: true },
      { id: "042", name: "Site 042", note: "Canyon Campground (sites 25⁠–⁠77)" },
      { id: "B12", name: "Site B12", note: "Beach Campground" },
      { id: "B20", name: "Site B20", note: "Beach Campground" },
    ],
  },
};

/** The hold an 8am offer link is about (HoldConfirm's preview). */
export const HOLD = {
  campground: "Leo Carrillo State Park",
  part: "Canyon Campground (sites 1⁠–⁠24)",
  unit: "Site 017",
  stay: "Aug 1–3",
  nights: 2,
};

/** The site the bot has in its ReserveCalifornia cart (ClaimFlow). */
export const CLAIM = {
  unit: "Site 042",
  place: "Leo Carrillo State Park — Canyon Campground (sites 25⁠–⁠77)",
  stay: "Aug 8–10",
  nights: 2,
  minutesLeft: 38,
};

export const EMAIL = "camper@example.com";
