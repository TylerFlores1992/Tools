// What lives behind the Private tab. Add a project here and it appears on /private.
// Everything under /private is signed-in only (src/proxy.ts) and never indexed.
export type PrivateProject = {
  slug: string;
  name: string;
  summary: string;
  /** What's there so far, in a few words. */
  stage: string;
  href: string;
};

export const PRIVATE_PROJECTS: readonly PrivateProject[] = [
  {
    slug: "mail",
    name: "Morning Mail",
    summary: "What came in overnight across Gmail and Yahoo, and what your rules tidied. All code, no AI.",
    stage: "Daily at 7",
    href: "/private/mail",
  },
  {
    slug: "recordings",
    name: "Recordings",
    summary: "The home DVR: what's coming up, what's recorded, and what to record next. Ads come out by themselves.",
    stage: "Series, one-offs, library and trash",
    href: "/private/recordings",
  },
  {
    slug: "money",
    name: "Money",
    summary: "Household spending, income and recurring payments, synced daily from the banks.",
    stage: "Chase + U.S. Bank",
    href: "/private/money",
  },
  {
    slug: "learn",
    name: "Learn to read code",
    summary: "Short hands-on lessons for reading, tracing and reviewing code, with a spaced review that syncs across devices.",
    stage: "Phase 1: JavaScript and TypeScript basics",
    href: "/private/learn",
  },
  {
    slug: "vectorworks",
    name: "Vectorworks",
    summary: "The drawing open on your computer, live: select, drag, measure, edit fixtures. Claude draws through the same connector.",
    stage: "Connector + live panel",
    href: "/private/vectorworks",
  },
  {
    slug: "camphawk",
    name: "CampHawk lab",
    summary: "CampHawk's pages in a new look, with fake data. Try ideas here before they ship.",
    stage: "Golden hour look: home and campground pages",
    href: "/private/camphawk/golden-hour",
  },
];
