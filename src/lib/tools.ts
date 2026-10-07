// The workshop's contents. Counts and copy elsewhere are derived from this list, never typed by hand.
export type Tool = {
  slug: string;
  name: string;
  summary: string;
  kind: string;
  /** 1 = runs in the browser on this site · 2 = small server function · 3 = its own site, linked out */
  tier: 1 | 2 | 3;
  status: "live" | "building";
  href?: string;
};

export const TOOLS: readonly Tool[] = [
  { slug: "bridle-calculator", name: "Two-leg bridle", kind: "Rigging · calculator", tier: 1, status: "live", summary: "Drag the bridle point; read leg lengths, tensions and the math worked by hand." },
  { slug: "etcp-rigger-study", name: "ETCP rigger study", kind: "Rigging · study", tier: 1, status: "live", summary: "Three practice tests with worked answers, flashcards and a formula reference." },
  { slug: "camphawk", name: "CampHawk", kind: "Camping · service", tier: 3, status: "live", href: "https://camphawk.app", summary: "Texts you within seconds when a booked campground opens up." },
];

export function toolBySlug(slug: string): Tool {
  const t = TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(`No tool with slug "${slug}"`);
  return t;
}

/** Where a tool lives: its page on this site, or its own site for tier 3. */
export const toolHref = (t: Tool) => t.href ?? `/workshop/${t.slug}`;
