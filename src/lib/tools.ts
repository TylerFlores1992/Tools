// The workshop's contents. Counts and copy elsewhere are derived from this list, never typed by hand.
export type Tool = {
  slug: string;
  name: string;
  summary: string;
  /** 1 = runs in the browser on this site · 2 = small server function · 3 = its own site, linked out */
  tier: 1 | 2 | 3;
  href?: string;
};

export const TOOLS: readonly Tool[] = [
  { slug: "bridle-calculator", name: "Two-leg bridle", tier: 1, summary: "Drag the bridle point; read leg lengths, tensions and the math worked by hand." },
  { slug: "etcp-rigger-study", name: "ETCP rigger study", tier: 1, summary: "Practice tests, flashcards and the formula sheet, all original." },
  { slug: "camphawk", name: "CampHawk", tier: 3, href: "https://camphawk.app", summary: "Texts you within seconds when a booked campground opens up." },
];
