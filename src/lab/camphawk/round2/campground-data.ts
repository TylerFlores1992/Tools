// Example data for the campground mockup (lab only; nothing here is live or read from CampHawk).
// "Today" is pinned to Jul 6, 2026 so the page tells the same story as the home page: site 042
// at Upper Pines opens for Jul 18-21. The later months show CampHawk's other calendar states:
// September couldn't be read (never drawn as booked), October is not open for booking (closed
// for the season, its own mark), and November's request failed (an error, said in words).

export const TODAY = "2026-07-06";

/** `type` reads after the loop in a sentence ("Loop C, RV up to 35 ft"), so it is lower-case except for proper initialisms. */
export type Site = { id: string; name: string; loop: string; type: string };

export const SITES: Record<string, Site> = {
  "009": { id: "009", name: "Site 009", loop: "Loop A", type: "tent only" },
  "042": { id: "042", name: "Site 042", loop: "Loop A", type: "tent only" },
  "063": { id: "063", name: "Site 063", loop: "Loop B", type: "standard nonelectric" },
  "088": { id: "088", name: "Site 088", loop: "Loop B", type: "standard nonelectric" },
  "101": { id: "101", name: "Site 101", loop: "Loop C", type: "RV nonelectric" },
  "117": { id: "117", name: "Site 117", loop: "Loop C", type: "standard nonelectric" },
  "130": { id: "130", name: "Site 130", loop: "Loop D", type: "tent only" },
};

type Month = { open: Record<string, string[]>; unknown?: boolean; closed?: boolean; error?: boolean };

/** Open sites per night, by month ("YYYY-MM"). Nights not listed are fully booked. */
export const MONTHS: Record<string, Month> = {
  "2026-07": { open: { "2026-07-09": ["117"], "2026-07-18": ["042"], "2026-07-19": ["042"], "2026-07-20": ["042"], "2026-07-27": ["088", "101"] } },
  "2026-08": { open: { "2026-08-02": ["063"], "2026-08-14": ["042", "130"], "2026-08-15": ["042", "130"], "2026-08-22": ["009"] } },
  "2026-09": { open: {}, unknown: true },
  "2026-10": { open: {}, closed: true },
  "2026-11": { open: {}, error: true },
};
export const FIRST_MONTH = "2026-07";
export const LAST_MONTH = "2026-11";

export const CAMPGROUND = {
  name: "Upper Pines",
  place: "Yosemite Valley, CA",
  stateName: "California",
  provider: "Recreation.gov",
  autoCart: true,
  description:
    "A large, wooded campground on the valley floor, a short walk from the river and the trailheads. Every site has a picnic table and a fire ring, and food lockers are provided.",
  amenities: ["Flush toilets", "Drinking water", "Food storage lockers", "Fire rings", "Picnic tables"],
  // 555-01xx is reserved for fiction.
  phone: "(209) 555-0142",
};

// From campsite-finder src/lib/booking-policy.ts (same words).
export const FIRST_COME_BADGE = "First come, first served";
export const FIRST_COME_WHY =
  "This campground doesn't take reservations, so there's nothing to cancel and an alert would never arrive. Sites go to whoever turns up.";

// From campsite-finder src/lib/seo.ts campgroundOpeningsHeading/Body (same words).
export const openingsHeading = (name: string) => `Is ${name} fully booked?`;
export function openingsBody(name: string, place: string, hasAutoCart: boolean): string[] {
  const where = place ? ` in ${place}` : "";
  return [
    "A campground showing no availability is almost never full for good. People cancel — plans change, weather turns, someone books three weekends and keeps one — and the site goes straight back into the booking system, usually without warning and often at odd hours. The reason sold-out campgrounds feel impossible is not that sites never free up; it is that nobody is watching at the moment they do.",
    `CampHawk watches ${name}${where} for you. We recheck it every 15 seconds, around the clock, and the moment a site opens we send a text, an email and a push notification` +
      (hasAutoCart
        ? " — and on Recreation.gov we can put the site straight into your cart, so it is held while you get to your phone."
        : ", with a link straight to the booking page."),
    `Searching is free and needs no account — the calendar above is live right now. Watching ${name} for cancellations is the paid part.`,
  ];
}

// Dates as strings, like CampHawk's date.ts: `new Date("2026-07-18")` is midnight UTC and
// renders as Jul 17 in every US timezone, so build local dates from parts.
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const local = (iso: string) => { const [y, m, d] = parts(iso); return new Date(y, m - 1, d); };
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const monthLabel = (month: string) => { const [y, m] = parts(`${month}-01`); return `${MONTH_NAMES[m - 1]} ${y}`; };
export const daysIn = (month: string) => { const [y, m] = parts(`${month}-01`); return new Date(y, m, 0).getDate(); };
export const firstWeekday = (month: string) => local(`${month}-01`).getDay();
/** "Saturday, July 18" */
export const dayLabel = (iso: string) => { const d = local(iso); return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`; };
export const shiftMonth = (month: string, by: number) => { const [y, m] = parts(`${month}-01`); const d = new Date(y, m - 1 + by, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
