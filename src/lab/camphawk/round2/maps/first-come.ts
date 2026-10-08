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

// Words that don't tell one campground from another, and spellings that mean the same word.
const NAME_STOP = new Set(["campground", "campgrounds", "camground", "campgound", "camp", "camping", "cg", "campsite", "campsites", "site", "sites", "recreation", "rec", "area", "the", "and", "of", "at", "national", "forest", "nf", "park"]);
const NAME_SAME: Record<string, string> = { mt: "mount", mtn: "mountain", ck: "creek", crk: "creek", lk: "lake", spgs: "springs", spg: "spring", ft: "fort", pt: "point" };

/** The words of a campground's name that tell it apart: lowercase, without accents, apostrophes,
    a parenthetical ("(CO)", "(Salida, CO)") or words every campground name has. */
export function nameWords(name: string): string[] {
  const plain = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/\([^)]*\)/g, " ");
  return [...new Set(plain.split(/[^a-z0-9]+/).filter(Boolean).map((w) => NAME_SAME[w] ?? w).filter((w) => !NAME_STOP.has(w)))];
}

/** Whether two names are one campground's: every telling word of one is in the other ("Spruce
    Grove (CO)" and "Spruce Grove Campground - Grand Valley RD"), never "Kenosha East" and
    "Kenosha Pass Campground", or "Davis Flat" and "South Fork Campground". */
export function sameCampground(a: string, b: string): boolean {
  const A = nameWords(a), B = nameWords(b);
  if (!A.length || !B.length) return false;
  const inB = (w: string) => B.some((v) => sameWord(w, v)), inA = (w: string) => A.some((v) => sameWord(w, v));
  if (A.every(inB) || B.every(inA)) return true;
  // Words run together: "Fourmile" and "Four Mile Creek Campground".
  const ja = A.join(""), jb = B.join("");
  return Math.min(ja.length, jb.length) >= 6 && (ja.includes(jb) || jb.includes(ja));
}

/** One word, allowing a single typo in a long one ("Penstemon", OpenStreetMap's "Penstmon"). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1 || /\d/.test(a + b)) return false;
  // At most one letter added, dropped or changed.
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export type NamedRing = { ring: Pt[]; name: string };
export type OutlinePick = {
  /** Every ring of the campground (one campground can be mapped as several). */
  rings: Pt[][];
  /** The ring nearest the listed point: where the label and "Open in a maps app" go. */
  ring: Pt[];
  pointOutsideM: number;
  /** OpenStreetMap's name for it; empty when the outline has none. */
  name: string;
};

/**
 * The listing's own outline among OpenStreetMap's (docs/design/campground-maps-first-come.md):
 * - one whose name is the listing's, within OUTLINE_REACH_M, whatever else is nearer, with every
 *   ring of that name (exact names first, then the nearest);
 * - else the nearest unnamed one, unless a ring named for another campground is as near: a
 *   nameless shape beyond someone else's campground isn't ours either;
 * - never one named for another campground. That one comes back as `other`, so the check can say
 *   why there's no outline.
 */
export function pickOutline(at: Pt, rings: NamedRing[], listingName: string, reach = OUTLINE_REACH_M): { pick: OutlinePick | null; other: { name: string; m: number } | null } {
  const near = rings.map((r) => ({ ...r, m: inside(at, r.ring) ? 0 : distToRing(at, r.ring) })).filter((r) => r.m <= reach).sort((a, b) => a.m - b.m);
  const named = near.filter((r) => r.name.trim());
  const ours = named.filter((r) => sameCampground(listingName, r.name));
  const others = named.filter((r) => !sameCampground(listingName, r.name));
  const other = others.length ? { name: others[0].name.trim(), m: others[0].m } : null;
  if (ours.length) {
    const key = (n: string) => nameWords(n).sort().join(" ");
    const exact = ours.find((r) => key(r.name) === key(listingName));
    const best = exact ?? ours[0];
    const all = ours.filter((r) => key(r.name) === key(best.name));
    return { pick: { rings: all.map((r) => r.ring), ring: best.ring, pointOutsideM: Math.min(...all.map((r) => r.m)), name: best.name.trim() }, other };
  }
  const unnamed = near.find((r) => !r.name.trim());
  if (unnamed && (!other || unnamed.m < other.m)) return { pick: { rings: [unnamed.ring], ring: unnamed.ring, pointOutsideM: unnamed.m, name: "" }, other };
  return { pick: null, other };
}

/** The campground's own outline on the built map (pickOutline over the build's outlines and their
    names); null when OpenStreetMap has none near it that could be this campground's. */
export function campgroundOutline(map: SiteMapData): OutlinePick | null {
  const at = map.sites[0]?.at;
  if (!at || !map.evidence?.outline) return null;
  const names = map.evidence.outlineNames ?? [];
  const rings = polygonsOf(map.evidence.outline).map((ring, i) => ({ ring, name: names[i] ?? "" }));
  return pickOutline(at, rings, map.firstCome?.name ?? map.name ?? "").pick;
}

/** The frame to draw: the outline with room around it (and the listed point), never under
    minSide; or minSide around the point when there's no outline. `aspect` is width / height. */
export function firstComeFrame(map: SiteMapData, aspect = 1, minSide = 320): SiteMapData["frame"] {
  const at = map.sites[0]?.at ?? [map.frame.x + map.frame.w / 2, map.frame.y + map.frame.h / 2];
  const o = campgroundOutline(map);
  const pts: Pt[] = o ? [...o.rings.flat(), at] : [at];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // Modest room, so the campground fills about half the map (critic round 1).
  const pad = Math.max(60, 0.15 * Math.max(x1 - x0, y1 - y0));
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  let w = Math.max(x1 - x0, minSide), h = Math.max(y1 - y0, minSide / aspect);
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** The middle of a ring (its vertices' mean), for "Open in a maps app". */
export const ringCenter = (ring: Pt[]): Pt => [ring.reduce((a, p) => a + p[0], 0) / ring.length, ring.reduce((a, p) => a + p[1], 0) / ring.length];

/** The campground's restrooms: inside its outline (`inside`), and the ones within `reach` metres of
    it (`nearby`, a trailhead toilet across the road isn't the campground's own). With no outline,
    every restroom within 2 x reach of the listed point is only `nearby`: we can't say it's inside. */
export function campgroundRestrooms(map: SiteMapData, reach = 150): { inside: SiteMapData["pois"]; nearby: SiteMapData["pois"] } {
  const o = campgroundOutline(map), at = map.sites[0]?.at;
  const wcs = map.pois.filter((p) => p.type === "Restroom");
  if (o) {
    const inAny = (p: Pt) => o.rings.some((r) => inside(p, r));
    return { inside: wcs.filter((p) => inAny(p.at)), nearby: wcs.filter((p) => !inAny(p.at) && Math.min(...o.rings.map((r) => distToRing(p.at, r))) <= reach) };
  }
  return { inside: [], nearby: at ? wcs.filter((p) => Math.hypot(p.at[0] - at[0], p.at[1] - at[1]) <= 2 * reach) : [] };
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

/** A scale bar that fits: the round length nearest a sixth of the frame (a fifth ran to a quarter
    of a wide map: critic round 1), never over 22% of it (at 1,380 m the nearest is 1,000 ft, 22.1%). */
export function fittedScaleBar(frameW: number): { ft: number; metres: number } {
  const steps = [25, 50, 100, 200, 250, 300, 500, 1000, 1320, 2640, 5280];
  const max = frameW * 0.22 * 3.28084, target = (frameW / 6) * 3.28084;
  const ok = steps.filter((ft) => ft <= max);
  const ft = (ok.length ? ok : [steps[0]]).reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  return { ft, metres: ft / 3.28084 };
}

type Label = { text: string; at: Pt; angle: number };
/** The map's names that fit: none that would run off the frame or overlap a name already kept
    (or the reserved boxes, such as the outline's label). Widths are estimated at `pxPerChar` on a
    map `widthPx` across, the narrowest it is drawn (a phone). */
export function fittedLabels<T extends Label>(labels: T[], f: { x: number; y: number; w: number; h: number }, reserved: { x0: number; y0: number; x1: number; y1: number }[] = [], widthPx = 340, pxPerChar = 6.6): T[] {
  const k = f.w / widthPx;
  const kept: { x0: number; y0: number; x1: number; y1: number }[] = [...reserved];
  const out: T[] = [];
  for (const l of labels) {
    const half = (l.text.length * pxPerChar * k) / 2, tall = 8 * k;
    const a = (l.angle * Math.PI) / 180, hx = Math.abs(Math.cos(a)) * half + Math.abs(Math.sin(a)) * tall, hy = Math.abs(Math.sin(a)) * half + Math.abs(Math.cos(a)) * tall;
    const box = { x0: l.at[0] - hx, y0: l.at[1] - hy, x1: l.at[0] + hx, y1: l.at[1] + hy };
    if (box.x0 < f.x || box.y0 < f.y || box.x1 > f.x + f.w || box.y1 > f.y + f.h) continue;
    if (kept.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
    kept.push(box); out.push(l);
  }
  return out;
}
