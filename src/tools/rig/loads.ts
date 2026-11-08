// What each roof tower carries: the grid's own weight, shared out by where each piece sits.
// Planning arithmetic (simple spans, no continuity), not engineering; the UI says so.
import { ROOF, SERIES } from "./catalog.ts";
import { fitBays } from "./templates.ts";
import type { BuildList, Part, RigDesign } from "./types.ts";

export type TowerLoad = { side: "front" | "back"; index: number; x: number; y: number; lb: number };

/** Weight of one part as the grid carries it (towers, bases and head blocks stand on the floor). */
function gridWeight(p: Part, lbPerFt: number, cornerLb: number): number {
  if (p.kind === "truss") return p.role === "tower" ? 0 : (p.length / 12) * lbPerFt;
  if (p.kind === "corner") return p.role === "head" ? 0 : p.role === "sleeve" ? ROOF.sleeve.lb : cornerLb;
  return 0;
}

const mid = (p: Part): [number, number] =>
  p.kind === "truss" ? [(p.start[0] + p.end[0]) / 2, (p.start[1] + p.end[1]) / 2] : p.kind === "corner" ? [p.center[0], p.center[1]] : [0, 0];

/** Share `lb` at `t` between the supports at `a` and `b` as a simple span would. */
const split = (lb: number, t: number, a: number, b: number): [number, number] => {
  const f = b === a ? 0.5 : Math.min(1, Math.max(0, (t - a) / (b - a)));
  return [lb * (1 - f), lb * f];
};

/**
 * The self weight each tower's hoist lifts, for a roof template. Long-beam pieces go to the two
 * towers of their bay; cross-beam pieces to the front and back tower of their line; spine pieces
 * to the cross beams at the ends of their bay, then half to each of that line's towers.
 */
export function towerLoads(design: RigDesign, list: BuildList): TowerLoad[] {
  if (design.template !== "roof") return [];
  const p = design.params;
  const s = SERIES[list.series.id];
  const bays = fitBays(p.bays, p.towers, p.width);
  const xs = bays.reduce((acc, b) => [...acc, acc[acc.length - 1] + b], [0]);
  const D = p.depth;
  const front = xs.map(() => 0);
  const back = xs.map(() => 0);
  const bayOf = (x: number) => Math.max(0, Math.min(bays.length - 1, xs.findIndex((v, i) => i > 0 && x <= v + 0.01) - 1));
  const line = (x: number) => xs.reduce((best, v, i) => (Math.abs(v - x) < Math.abs(xs[best] - x) ? i : best), 0);
  for (const part of list.parts) {
    const lb = gridWeight(part, s.lbPerFt, s.cornerLb);
    if (!lb) continue;
    const [x, y] = mid(part);
    const onFront = Math.abs(y) < 1;
    const onBack = Math.abs(y - D) < 1;
    const atLine = Math.abs(xs[line(x)] - x) < 1;
    if ((onFront || onBack) && !(atLine && part.kind === "corner" && part.role !== "sleeve")) {
      const arr = onFront ? front : back;
      if (part.kind === "corner") arr[line(x)] += lb;
      else {
        const k = bayOf(x);
        const [a, b] = split(lb, x, xs[k], xs[k + 1]);
        arr[k] += a;
        arr[k + 1] += b;
      }
    } else if (atLine) {
      const k = line(x);
      const [a, b] = split(lb, y, 0, D);
      front[k] += a;
      back[k] += b;
    } else {
      // A spine piece: to the cross beams at its bay's ends (their middles), half to each tower there.
      const k = bayOf(x);
      const [a, b] = split(lb, x, xs[k], xs[k + 1]);
      front[k] += a / 2;
      back[k] += a / 2;
      front[k + 1] += b / 2;
      back[k + 1] += b / 2;
    }
  }
  return [
    ...xs.map((x, i) => ({ side: "front" as const, index: i, x, y: 0, lb: front[i] })),
    ...xs.map((x, i) => ({ side: "back" as const, index: i, x, y: D, lb: back[i] })),
  ];
}
