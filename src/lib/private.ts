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
    slug: "money",
    name: "Money",
    summary: "Household spending, income and recurring payments, synced daily from the banks.",
    stage: "Chase + U.S. Bank",
    href: "/private/money",
  },
  {
    slug: "camphawk",
    name: "CampHawk lab",
    summary: "CampHawk's pages in a new look, with fake data. Try ideas here before they ship.",
    stage: "Golden hour look: home and campground pages",
    href: "/private/camphawk/golden-hour",
  },
];
