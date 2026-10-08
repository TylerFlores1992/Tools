// Where a site map's numbers go at a given drawn width. Pure, so it's tested (layout.test.mts).
import type { MapSite, SiteMapData } from "./index";

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Placed = { name: string; cx: number; cy: number };

/** px position of a point on a map drawn `width` px wide. */
export function toPx(map: SiteMapData, [x, y]: [number, number], width: number): [number, number] {
  const s = width / map.frame.w;
  return [(x - map.frame.x) * s, (y - map.frame.y) * s];
}

/** Distance from a point to the nearest edge of a box (0 inside it). */
export const gapTo = (b: Box, [x, y]: [number, number]) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const around = ([x, y]: [number, number], w: number, h: number): Box => ({ x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 });

/**
 * Site numbers that fit, each beside its own dot on the side away from the road. Greedy, in
 * priority order: `first` (a found site), then every tenth site, then the rest in number order.
 * A number is dropped when its box would touch a symbol, a pin, another number, or the edge.
 * `obstacles` are px boxes the caller already drew (symbols, pins and their labels, road names).
 */
export function placeNumbers(map: SiteMapData, sites: MapSite[], width: number, obstacles: Box[], opts: { charPx: number; linePx: number; first?: string } ): Placed[] {
  if (!width) return [];
  const height = (width * map.frame.h) / map.frame.w;
  const taken = [...obstacles];
  const out: Placed[] = [];
  const rank = (s: MapSite) => (s.name === opts.first ? 0 : /^\d+$/.test(s.name) && Number(s.name) % 10 === 0 ? 1 : 2);
  const order = sites.filter((s) => s.at).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "en", { numeric: true }));
  // Every dot is an obstacle for every other site's number (but not its own).
  const dots = new Map(order.map((s) => [s.name, around(toPx(map, s.at!, width), 6, 6)]));
  for (const s of order) {
    const [px, py] = toPx(map, s.at!, width);
    const [ox, oy] = s.out ?? [0, 1];
    const w = s.name.length * opts.charPx + 4, h = opts.linePx;
    // Try straight out from the road first, then swung 45° and 90° either way (still on the
    // dot's own side of the road). Each box is centred just past the dot in that direction.
    for (const deg of [0, 45, -45, 90, -90]) {
      const r = (deg * Math.PI) / 180;
      const dx = ox * Math.cos(r) - oy * Math.sin(r), dy = ox * Math.sin(r) + oy * Math.cos(r);
      const reach = 5 + Math.abs(dx) * (w / 2) + Math.abs(dy) * (h / 2);
      const box = around([px + dx * reach, py + dy * reach], w, h);
      if (box.x0 < 2 || box.y0 < 2 || box.x1 > width - 2 || box.y1 > height - 2) continue;
      if (taken.some((t) => overlaps(t, box))) continue;
      if ([...dots].some(([n, d]) => n !== s.name && overlaps(d, box))) continue;
      // A number must be unmistakably its own dot's: no other dot may sit nearly as close to
      // it. A number between two dots is worse than none, because it names the wrong site.
      const mine = gapTo(box, [px, py]);
      if (order.some((o) => o.name !== s.name && gapTo(box, toPx(map, o.at!, width)) < mine + 6)) continue;
      taken.push(box);
      out.push({ name: s.name, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2 });
      break;
    }
  }
  return out;
}

/** "157", "site 157", "#57", "57" → the map's spelling ("157", "057"), or null. */
export function findSite(map: SiteMapData, query: string): MapSite | null {
  const q = query.trim().replace(/^(site\s*)?#?\s*/i, "");
  if (!q) return null;
  const exact = map.sites.find((s) => s.name.toLowerCase() === q.toLowerCase());
  if (exact) return exact;
  if (/^\d+$/.test(q)) return map.sites.find((s) => /^\d+$/.test(s.name) && Number(s.name) === Number(q)) ?? null;
  return null;
}
