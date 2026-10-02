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
    slug: "camphawk",
    name: "CampHawk lab",
    summary: "CampHawk's pages in a new look, with fake data. Try ideas here before they ship.",
    stage: "Home page",
    href: "/private/camphawk",
  },
];
