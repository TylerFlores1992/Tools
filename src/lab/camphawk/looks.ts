// The "new look" mockups for CampHawk's home page. Every look keeps the same page, words,
// controls and palette; only the backdrop and the finish change. Art is drawn in code
// (studio/camphawk-looks/) except "painted", which is CampHawk's own unused valley painting.

export type LookId = "current" | "ridgeline" | "topo" | "engraving" | "poster" | "dusk" | "painted";

export type Look = {
  id: LookId;
  name: string;
  /** One line: what it is. */
  blurb: string;
  /** What it changes beyond the backdrop, in plain words. */
  finish: string;
  /** A note when the look bends CampHawk's own design rules. */
  departs?: string;
  /** Background art, phone and desktop crops (under /private/camphawk/looks/). */
  art?: { phone: string; desktop: string };
};

const art = (name: string) => ({ phone: `/private/camphawk/looks/${name}-phone.webp`, desktop: `/private/camphawk/looks/${name}-desktop.webp` });

export const LOOKS: Look[] = [
  {
    id: "current",
    name: "Current",
    blurb: "camphawk.app as it is today, for comparison.",
    finish: "Painted scene under a paper wash, desktop only.",
  },
  {
    id: "ridgeline",
    name: "Ridgeline",
    blurb: "Six ranges fading into morning haze, a low sun, the hawk overhead.",
    finish: "The headline sits in open sky; cards rise out of the treeline with a deeper, softer shadow.",
    departs: "The sky is a soft gradient with a sun halo; CampHawk's rules avoid gradients and glows.",
    art: art("ridgeline"),
  },
  {
    id: "topo",
    name: "Topo",
    blurb: "A trail map: hillshade, contour lines, a lake, campsites along a dashed trail.",
    finish: "The map runs behind the whole page; cards sit on it like labels, with a fine double edge.",
    art: art("topo"),
  },
  {
    id: "engraving",
    name: "Field guide",
    blurb: "An engraved plate: ranges in fine linework, hatched pines, a ringed sun.",
    finish: "Warm paper, hairline rules, cards framed like plates in a guidebook.",
    art: art("engraving"),
  },
  {
    id: "poster",
    name: "Park poster",
    blurb: "Flat-color national-park poster: banded sky, big sun, blue ranges, a river.",
    finish: "Bolder: no soft shadows, firmer borders, the boldest of the set.",
    art: art("poster"),
  },
  {
    id: "dusk",
    name: "Dusk",
    blurb: "Night over the ridges: stars, a crescent moon, a campfire by a tent.",
    finish: "A dark hero with light type; the rest of the page returns to paper.",
    departs: "CampHawk's rules keep the site light. This look goes dark at the top, and the fire and moon glow.",
    art: art("dusk"),
  },
  {
    id: "painted",
    name: "Painted",
    blurb: "CampHawk's own valley painting (unused today), full strength behind the hero.",
    finish: "No wash over the art; it fades into paper under the headline.",
    art: { phone: "/private/camphawk/looks/painted-valley.webp", desktop: "/private/camphawk/looks/painted-valley.webp" },
  },
];

export const DEFAULT_LOOK: LookId = "current";

/** A look id from a URL value, or the default. */
export function toLook(value: string | string[] | undefined): LookId {
  const v = Array.isArray(value) ? value[0] : value;
  return LOOKS.some((l) => l.id === v) ? (v as LookId) : DEFAULT_LOOK;
}

export const lookById = (id: LookId) => LOOKS.find((l) => l.id === id)!;
