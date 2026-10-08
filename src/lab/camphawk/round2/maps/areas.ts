// A Recreation.gov listing isn't always one campground. Some are several clusters kilometres apart
// (Seven Points: six around a lake), some one long string of loops (Diamond Lake: ten loops over
// 3.5 km of shore), some dispersed sites along a river (Au Sable: 101 sites over 35 km). Drawn as one
// map, each loop is too small to read (wave 1, 2026-10-08: 10 of the 20 maps held). This splits a
// listing into areas a camper can read, from the site points alone. Pure, so it's tested
// (areas.test.mts) against wave 1's real listings.
import type { MapSite, SiteMapData } from "./index";

type Pt = { name: string; at: [number, number] };
export type Area = {
  /** "Loop A", "Loops B–D", "Sites 001–045": what the sites themselves are called. */
  name: string;
  /** Site names, in number order. */
  sites: string[];
  /** The box the area's own map shows, in the map's metres (padded, never thinner than 1:2). */
  frame: { x: number; y: number; w: number; h: number };
  /** The middle of its sites, for the overview's marker. */
  center: [number, number];
};
export type Split =
  | { kind: "one" }
  | { kind: "areas"; areas: Area[] }
  /** Too many small groups to draw as areas: shown as a list with an overview (Au Sable). */
  | { kind: "dispersed"; groups: number };

/** Sites closer than this belong to the same area (m). */
export const AREA_GAP_M = 200;
/** A listing that fits in this (m) stays one map unless a person says it's several places
    (`opts.oneMap: 0`). Measured on waves 1 and 2 (2026-10-08, after the first looks): no span
    separates split listings from big campgrounds. At 1.5 km it catches 14 of the 29 the photo
    called split and splits 2 of the usable maps; at 1.2 km 19 and 6; at 800 m 27 and 27. So the
    automatic default stays conservative and a person's "split listing" call turns it on. */
export const ONE_MAP_SPAN_M = 1500;
/** An area wider or taller than this is cut again (m): about what a phone shows readably. */
export const AREA_MAX_SPAN_M = 1000;
/** More areas than this, or areas this small on average, is a dispersed listing. */
export const MAX_AREAS = 12;
const PAD_M = 50;

const byNumber = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
const span = (ps: Pt[]) => {
  const xs = ps.map((p) => p.at[0]), ys = ps.map((p) => p.at[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};
const prefix = (name: string) => /^([A-Z]{1,2})\d/.exec(name)?.[1] ?? null;

/** Single-linkage groups: two sites closer than `gap` are in the same group. */
export function groupsByGap(ps: Pt[], gap = AREA_GAP_M): Pt[][] {
  const parent = ps.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++)
      if (Math.hypot(ps[i].at[0] - ps[j].at[0], ps[i].at[1] - ps[j].at[1]) <= gap) parent[find(i)] = find(j);
  const out = new Map<number, Pt[]>();
  ps.forEach((p, i) => (out.get(find(i)) ?? out.set(find(i), []).get(find(i))!).push(p));
  return [...out.values()];
}

/** Cut a group that's too big to read: by its loop letters where the sites have them, else at the
    widest gap along its long side, until every piece fits. */
function cut(g: Pt[], maxSpan: number, byLetter = true): Pt[][] {
  if (g.length < 2 || span(g) <= maxSpan) return [g];
  const letters = [...new Set(g.map((p) => prefix(p.name)))];
  if (byLetter && letters.length > 1 && !letters.includes(null)) {
    // Whole loops, merged in letter order while the union still fits.
    const loops = (letters as string[]).sort().map((l) => g.filter((p) => prefix(p.name) === l));
    const out: Pt[][] = [];
    for (const loop of loops) {
      const last = out.at(-1);
      if (last && span([...last, ...loop]) <= maxSpan) last.push(...loop);
      else out.push([...loop]);
    }
    if (out.length > 1) return out.flatMap((o) => cut(o, maxSpan));
  }
  const xs = g.map((p) => p.at[0]), ys = g.map((p) => p.at[1]);
  const axis = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 0 : 1;
  const sorted = [...g].sort((a, b) => a.at[axis] - b.at[axis]);
  // The widest gap in the middle half, so neither side is a sliver.
  let at = Math.floor(sorted.length / 2), widest = -1;
  for (let i = Math.floor(sorted.length / 4); i < Math.ceil((3 * sorted.length) / 4); i++) {
    const d = sorted[i].at[axis] - sorted[i - 1]?.at[axis];
    if (i > 0 && d > widest) { widest = d; at = i; }
  }
  return [...cut(sorted.slice(0, at), maxSpan, byLetter), ...cut(sorted.slice(at), maxSpan, byLetter)];
}

/** What a camper calls the sites in an area: their loop letters, else the first and last number. */
export function areaName(names: string[]): string {
  const sorted = [...names].sort(byNumber);
  const letters = [...new Set(sorted.map(prefix))];
  if (!letters.includes(null)) {
    const ls = (letters as string[]).sort();
    if (ls.length === 1) return `Loop ${ls[0]}`;
    // Runs of single letters collapse ("A–C"); two in a row stay apart ("D and F", "A, B and E").
    const parts: string[] = [];
    for (let i = 0; i < ls.length; ) {
      let j = i;
      while (j + 1 < ls.length && ls[j].length === 1 && ls[j + 1].length === 1 && ls[j + 1].charCodeAt(0) === ls[j].charCodeAt(0) + 1) j++;
      if (j - i >= 2) parts.push(`${ls[i]}–${ls[j]}`); else for (let k = i; k <= j; k++) parts.push(ls[k]);
      i = j + 1;
    }
    return `Loops ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`}`;
  }
  const plain = sorted.filter((n) => /^\d+$/.test(n));
  const numbered = plain.length ? plain : sorted.filter((n) => /\d/.test(n));
  const ends = numbered.length ? [numbered[0], numbered.at(-1)!] : [sorted[0], sorted.at(-1)!];
  return ends[0] === ends[1] ? `Site ${ends[0]}` : `Sites ${ends[0]}–${ends[1]}`;
}

function frameOf(ps: Pt[]): Area["frame"] {
  const xs = ps.map((p) => p.at[0]), ys = ps.map((p) => p.at[1]);
  let x = Math.min(...xs) - PAD_M, y = Math.min(...ys) - PAD_M, w = Math.max(...xs) - Math.min(...xs) + 2 * PAD_M, h = Math.max(...ys) - Math.min(...ys) + 2 * PAD_M;
  // Never thinner than 1:2 either way, so a string of sites along a shore still reads as a place.
  if (w < h / 2) { x -= (h / 2 - w) / 2; w = h / 2; }
  if (h < w / 2) { y -= (w / 2 - h) / 2; h = w / 2; }
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
}

/** The share of sites that fall inside another group's convex hull (plus 10 m). */
function overlapShare(groups: Pt[][]): number {
  const rings = groups.map((g) => {
    const ring: [number, number][] = [];
    for (const p of g) for (let k = 0; k < 8; k++) ring.push([p.at[0] + 10 * Math.cos((k * Math.PI) / 4), p.at[1] + 10 * Math.sin((k * Math.PI) / 4)]);
    return hull(ring);
  });
  const inside = (ring: [number, number][], [x, y]: [number, number]) => ring.length >= 3 && ring.every((p, i) => { const q = ring[(i + 1) % ring.length]; return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) >= 0; });
  let n = 0, total = 0;
  groups.forEach((g, i) => { for (const p of g) { total++; if (rings.some((r, j) => j !== i && inside(r, p.at))) n++; } });
  return total ? n / total : 0;
}

/** Split a listing's placed sites into readable areas, or say it's one area, or dispersed. */
export function splitAreas(sites: MapSite[], opts: { gap?: number; maxSpan?: number; oneMap?: number } = {}): Split {
  const ps = sites.filter((s): s is MapSite & { at: [number, number] } => s.at !== null).map((s) => ({ name: s.name, at: s.at }));
  if (ps.length < 2) return { kind: "one" };
  const maxSpan = opts.maxSpan ?? AREA_MAX_SPAN_M;
  if (span(ps) <= (opts.oneMap ?? ONE_MAP_SPAN_M)) return { kind: "one" };
  // Sites named by loop ("A001", "F12"): whole loops are the pieces, never cut, merged in letter
  // order while they still fit (Diamond Lake). Otherwise, groups by the gaps between sites.
  const letters = new Set(ps.map((p) => prefix(p.name)));
  if (letters.size > 1 && !letters.has(null)) {
    // Whole loops in order along the listing's long axis (not letter order: Diamond Lake's letters
    // interleave along the shore, and merging by letter drew areas on top of each other).
    const xs = ps.map((p) => p.at[0]), ys = ps.map((p) => p.at[1]);
    const axis = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 0 : 1;
    const mean = (g: Pt[]) => g.reduce((t, p) => t + p.at[axis], 0) / g.length;
    const loops = [...letters as Set<string>].sort().map((l) => ps.filter((p) => prefix(p.name) === l)).sort((a, b) => mean(a) - mean(b));
    // A loop joins the area before it only if the two touch (within the gap): Lost Lake's F row and
    // its two H sites 1 km away fit in 1 km together, but they are two places (first look, 2026-10-08).
    const gap = opts.gap ?? AREA_GAP_M;
    const touches = (a: Pt[], b: Pt[]) => a.some((p) => b.some((q) => Math.hypot(p.at[0] - q.at[0], p.at[1] - q.at[1]) <= gap));
    const merged: Pt[][] = [];
    for (const loop of loops) {
      const last = merged.at(-1);
      if (last && span([...last, ...loop]) <= maxSpan && touches(last, loop)) last.push(...loop); else merged.push([...loop]);
    }
    // Loops that are parallel rows along one shore (Diamond Lake's G, H and K each run ~1.5 km
    // side by side) overlap whatever the grouping: then cut by position instead, below.
    if (overlapShare(merged) < 0.05) return toAreas(merged, ps.length);
    return toAreas(cut(ps, maxSpan, false), ps.length, axis);
  }
  const groups = groupsByGap(ps, opts.gap ?? AREA_GAP_M);
  // Many small groups is dispersed camping, whatever the cut would make of it.
  if (groups.length > MAX_AREAS && ps.length / groups.length < 6) return { kind: "dispersed", groups: groups.length };
  // A lone site or two near a bigger area belongs to it (a host site, a group camp).
  const big = groups.filter((g) => g.length >= 3), small = groups.filter((g) => g.length < 3);
  for (const g of small) {
    if (!big.length) { big.push(g); continue; }
    const near = (a: Pt[]) => Math.min(...a.flatMap((p) => g.map((q) => Math.hypot(p.at[0] - q.at[0], p.at[1] - q.at[1]))));
    const nearest = big.reduce((best, a) => (near(a) < near(best) ? a : best));
    if (near(nearest) <= maxSpan / 2) nearest.push(...g); else big.push(g);
  }
  return toAreas(big.flatMap((g) => cut(g, maxSpan)), ps.length);
}

function toAreas(pieces: Pt[][], placed: number, axis?: 0 | 1): Split {
  if (pieces.length === 1) return { kind: "one" };
  if (pieces.length > MAX_AREAS || placed / pieces.length < 4) return { kind: "dispersed", groups: pieces.length };
  const areas = pieces
    .map((p) => {
      const names = p.map((q) => q.name).sort(byNumber);
      const cx = p.reduce((s, q) => s + q.at[0], 0) / p.length, cy = p.reduce((s, q) => s + q.at[1], 0) / p.length;
      return { name: areaName(names), sites: names, frame: frameOf(p), center: [Math.round(cx), Math.round(cy)] as [number, number] };
    })
    // Cut by position, areas run in order along the listing (north to south, or west to east) and
    // say where they are, since one loop's sites may be in two of them.
    .sort((a, b) => (axis === undefined ? byNumber(a.sites[0], b.sites[0]) : a.center[axis] - b.center[axis]));
  // Ranges that interleave ("Sites 003–060" beside "Sites 042–214") would send a camper to the wrong
  // area: name those by where they are instead, like a cut along the shore.
  const range = (a: Area) => { const n = a.sites.filter((x) => /^\d+$/.test(x)).map(Number); return n.length ? [Math.min(...n), Math.max(...n)] : null; };
  const interleave = areas.some((a, i) => areas.some((b, j) => { if (i >= j) return false; const ra = range(a), rb = range(b); return !!ra && !!rb && ra[0] <= rb[1] && rb[0] <= ra[1]; }));
  if (interleave && axis === undefined) {
    const xs = areas.map((a) => a.center[0]), ys = areas.map((a) => a.center[1]);
    axis = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 0 : 1;
    areas.sort((a, b) => a.center[axis!] - b.center[axis!]);
  }
  if (axis !== undefined) {
    const ends = axis === 1 ? ["North end", "South end"] : ["West end", "East end"];
    areas.forEach((a, i) => { a.name = `${i === 0 ? ends[0] : i === areas.length - 1 ? ends[1] : `Middle ${areas.length > 3 ? i : ""}`.trim()}: ${a.name.replace(/^Loops? /, "loops ").replace(/^Sites? /, "sites ")}`; });
  }
  return { kind: "areas", areas };
}

/** The listing's map cropped to one area: same roads and water, only that area's sites. */
export function areaMap(map: SiteMapData, area: Area): SiteMapData {
  const keep = new Set(area.sites);
  const f = area.frame;
  const inside = ([x, y]: [number, number]) => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h;
  return {
    ...map,
    frame: f,
    sites: map.sites.filter((s) => keep.has(s.name)),
    pois: map.pois.filter((p) => inside(p.at)),
    labels: map.labels.filter((l) => inside(l.at)),
  };
}

/** The area a site is in (for Find a site), or null. */
export const areaOf = (split: Split, site: string) => (split.kind === "areas" ? split.areas.find((a) => a.sites.includes(site)) ?? null : null);

/** The convex hull of points (monotone chain), counter-clockwise. Fewer than 3 points come back as given. */
export function hull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** An area's outline: its sites' hull pushed out by `pad` metres (a rounded buffer, as a polygon). */
export function outline(map: SiteMapData, area: Area, pad: number): [number, number][] {
  const pts = map.sites.filter((s) => s.at && area.sites.includes(s.name)).map((s) => s.at!);
  const ring: [number, number][] = [];
  for (const [x, y] of pts) for (let k = 0; k < 12; k++) ring.push([x + pad * Math.cos((k * Math.PI) / 6), y + pad * Math.sin((k * Math.PI) / 6)]);
  return hull(ring);
}

/** Sites the listing publishes no point for: on no area's map, and said so. */
export const unplacedSites = (sites: MapSite[]) => sites.filter((s) => !s.at).map((s) => s.name);

/** How far a stray point was, for a camper: "1.4 miles", "17 miles", "1,430 miles". */
export const strayMiles = (m: number) => { const mi = m / 1609.34; return `${mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString("en-US")} miles`; };
