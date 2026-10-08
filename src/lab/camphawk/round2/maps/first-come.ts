import type { SiteMapData } from "./index";

// First-come campgrounds booked as one "Standard" site (docs/design/campground-maps-first-come.md).
// Recreation.gov lists them with a single placeholder site in a "Scan and Pay" loop; its point is
// near the entrance (often on the road), not on a pad. So the map draws the campground itself:
// OpenStreetMap's outline when it has one, and the listed point only for what it is.

/** What RIDB says about one first-come listing (studio/campground-maps/first-come.mjs). */
export type FirstComeFacts = {
  id: string;
  name: string;
  /** Only when the description states a number of sites. */
  sites: number | null;
  firstCome: boolean;
  scanAndPay: boolean;
  closed: boolean;
  access: string | null;
  maxPeople: number | null;
  maxVehicles: number | null;
  pets: string | null;
  campfires: string | null;
  amenities: string[];
};

/** A listing is a first-come campground when its only site is the "Standard" placeholder. */
export const isFirstCome = (map: SiteMapData) => map.sites.length === 1 && /^standard$/i.test(map.sites[0].name.trim());

type Pt = [number, number];

/** The polygons of an SVG path made of M/L/Z commands (the build's outline). */
export function polygonsOf(d: string): Pt[][] {
  return d.split(/Z/i).map((part) => [...part.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/gi)].map((m): Pt => [Number(m[1]), Number(m[2])])).filter((p) => p.length > 2);
}

const inside = ([px, py]: Pt, poly: Pt[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[j];
    if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) c = !c;
  }
  return c;
};

const distToRing = ([px, py]: Pt, poly: Pt[]) => {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
};

/** Farther than this from the listed point, an outline is someone else's campground. */
export const OUTLINE_REACH_M = 250;

/** The campground's own outline: the polygon holding the listed point, else the nearest one within
    OUTLINE_REACH_M; null when OpenStreetMap has none near it. With how far the point sits outside. */
export function campgroundOutline(map: SiteMapData): { ring: Pt[]; pointOutsideM: number } | null {
  const at = map.sites[0]?.at;
  if (!at || !map.evidence?.outline) return null;
  let best: { ring: Pt[]; pointOutsideM: number } | null = null;
  for (const ring of polygonsOf(map.evidence.outline)) {
    const m = inside(at, ring) ? 0 : distToRing(at, ring);
    if (m <= OUTLINE_REACH_M && (!best || m < best.pointOutsideM)) best = { ring, pointOutsideM: m };
  }
  return best;
}

/** The frame to draw: the outline with room around it (and the listed point), never under
    minSide; or minSide around the point when there's no outline. `aspect` is width / height. */
export function firstComeFrame(map: SiteMapData, aspect = 1, minSide = 420): SiteMapData["frame"] {
  const at = map.sites[0]?.at ?? [map.frame.x + map.frame.w / 2, map.frame.y + map.frame.h / 2];
  const o = campgroundOutline(map);
  const pts: Pt[] = o ? [...o.ring, at] : [at];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(80, 0.3 * Math.max(x1 - x0, y1 - y0));
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  let w = Math.max(x1 - x0, minSide), h = Math.max(y1 - y0, minSide / aspect);
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** The middle of a ring (its vertices' mean), for "Open in a maps app". */
export const ringCenter = (ring: Pt[]): Pt => [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];

/** Restrooms that belong to the campground: within `reach` metres of its outline, or of the listed
    point when there's no outline (a restroom at the next campground along the road isn't this one's). */
export function campgroundRestrooms(map: SiteMapData, reach = 150) {
  const o = campgroundOutline(map), at = map.sites[0]?.at;
  return map.pois.filter((p) => p.type === "Restroom" && (o ? inside(p.at, o.ring) || distToRing(p.at, o.ring) <= reach : at ? Math.hypot(p.at[0] - at[0], p.at[1] - at[1]) <= 2 * reach : false));
}

/** Where the outline's label goes: the ring's top edge above its middle, so it never covers the
    hatching's far end (the topmost vertex can be a tip at one end). */
export function outlineLabelAt(ring: Pt[]): Pt {
  const [cx] = ringCenter(ring);
  const xs = ring.map((p) => p[0]), span = Math.max(...xs) - Math.min(...xs);
  const near = ring.filter((p) => Math.abs(p[0] - cx) <= span * 0.2);
  const top = (near.length ? near : ring).reduce((a, p) => (p[1] < a[1] ? p : a));
  return [cx, top[1]];
}
