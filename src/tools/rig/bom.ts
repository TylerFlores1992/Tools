// Build list → what to rent, and roughly what it weighs.
import { BASEPLATE, CLAMP, CONNECTORS_PER_JOINT, CONNECTOR_LB, DECK, PIPE, RAIL, ROOF, SERIES, SKIRT, STAIRS } from "./catalog.ts";
import { ftIn } from "./templates.ts";
import type { BuildList, Vec3 } from "./types.ts";

export type RentalLine = { key: string; qty: number; item: string; note?: string; lb: number };

const near = (a: Vec3, b: Vec3, tol = 0.01) => Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol;

/** Places where a truss section connects to another section, a corner block or a base plate. */
export function countJoints(list: BuildList): number {
  const sticks = list.parts.filter((p) => p.kind === "truss");
  const corners = list.parts.filter((p) => p.kind === "corner");
  const plates = list.parts.filter((p) => p.kind === "baseplate");
  const joints: Vec3[] = [];
  const ends = sticks.flatMap((t) => [t.start, t.end]);
  for (const pt of ends) {
    if (joints.some((j) => near(j, pt))) continue;
    const otherStick = ends.filter((e) => near(e, pt)).length > 1;
    const onCorner = corners.some((c) => {
      const d = [pt[0] - c.center[0], pt[1] - c.center[1], pt[2] - c.center[2]].map(Math.abs).sort((a, b) => b - a);
      return Math.abs(d[0] - c.size / 2) < 0.01 && d[1] < 0.01 && d[2] < 0.01;
    });
    // A plate's top is at 0 for plates sunk below the floor, or twice its center for tower bases.
    const onPlate = plates.some((b) => Math.abs(pt[0] - b.center[0]) < 0.01 && Math.abs(pt[1] - b.center[1]) < 0.01 && Math.abs(pt[2] - Math.max(0, 2 * b.center[2])) < 0.01);
    const onHead = corners.some((c) => c.role === "head" && Math.abs(pt[0] - c.center[0]) < 0.01 && Math.abs(pt[1] - c.center[1]) < 0.01 && Math.abs(pt[2] - (c.center[2] - (c.thick ?? 0) / 2)) < 0.01);
    if (otherStick || onCorner || onPlate || onHead) joints.push(pt);
  }
  return joints.length;
}

export function rentalList(list: BuildList): RentalLine[] {
  const s = SERIES[list.series.id];
  const lines: RentalLine[] = [];
  const byLen = new Map<number, number>();
  for (const p of list.parts) if (p.kind === "truss") byLen.set(p.length, (byLen.get(p.length) ?? 0) + 1);
  for (const [len, qty] of [...byLen].sort((a, b) => b[0] - a[0])) {
    const item = len < 12 ? `${s.label} spacer, ${len}"` : `${s.label}, ${ftIn(len)} section`;
    lines.push({ key: `truss-${len}`, qty, item, lb: qty * (len / 12) * s.lbPerFt });
  }
  const sleeves = list.parts.filter((p) => p.kind === "corner" && p.role === "sleeve").length;
  if (sleeves) lines.push({ key: "sleeve", qty: sleeves, item: ROOF.sleeve.label, note: `${s.label.replace(" truss", "")} roof, with its climbing hoist`, lb: sleeves * ROOF.sleeve.lb });
  const heads = list.parts.filter((p) => p.kind === "corner" && p.role === "head").length;
  if (heads) lines.push({ key: "head", qty: heads, item: ROOF.head.label, lb: heads * ROOF.head.lb });
  const corners = list.parts.filter((p) => p.kind === "corner" && !p.role);
  if (corners.length) {
    const maxWays = Math.max(...corners.map((c) => (c.kind === "corner" ? c.ways : 0)));
    lines.push({ key: "corner", qty: corners.length, item: `${s.label} corner block, 6-way`, note: `uses ${maxWays} faces`, lb: corners.length * s.cornerLb });
  }
  const joints = countJoints(list);
  if (joints) {
    const qty = joints * CONNECTORS_PER_JOINT;
    lines.push({ key: "connectors", qty, item: "Truss connector sets (pin + clip, or bolt)", note: `${joints} joints × ${CONNECTORS_PER_JOINT} chords`, lb: qty * CONNECTOR_LB });
  }
  const plates = list.parts.filter((p) => p.kind === "baseplate");
  const bases = plates.filter((p) => p.size === ROOF.base.size).length;
  if (bases) lines.push({ key: "towerbase", qty: bases, item: ROOF.base.label, lb: bases * ROOF.base.lb });
  if (plates.length - bases) lines.push({ key: "baseplate", qty: plates.length - bases, item: BASEPLATE.label, lb: (plates.length - bases) * BASEPLATE.lb });
  const pipeLen = new Map<number, number>();
  for (const p of list.parts) if (p.kind === "pipe") pipeLen.set(p.length, (pipeLen.get(p.length) ?? 0) + 1);
  for (const [len, qty] of [...pipeLen].sort((a, b) => b[0] - a[0])) {
    lines.push({ key: `pipe-${len}`, qty, item: `${PIPE.label}, ${ftIn(len)}`, note: `${PIPE.od}" outside diameter`, lb: qty * (len / 12) * PIPE.lbPerFt });
  }
  const clamps = list.parts.filter((p) => p.kind === "clamp").length;
  if (clamps) lines.push({ key: "clamp", qty: clamps, item: CLAMP.label, note: "fits pipe and chord, about 2\"", lb: clamps * CLAMP.lb });

  const count = <T,>(items: T[], key: (x: T) => number) => {
    const m = new Map<number, number>();
    for (const x of items) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
    return [...m].sort((a, b) => b[0] - a[0]);
  };
  const decks = list.parts.filter((p) => p.kind === "deck");
  for (const [len, qty] of count(decks, (d) => d.length)) {
    const size = DECK.sizes[len] ?? { label: `${ftIn(DECK.width)} × ${ftIn(len)} stage deck`, lb: 0 };
    lines.push({ key: `deck-${len}`, qty, item: size.label, lb: qty * size.lb });
  }
  for (const [h, qty] of count(list.parts.filter((p) => p.kind === "leg"), (l) => l.height)) {
    lines.push({ key: `leg-${h}`, qty, item: `Stage deck leg, ${ftIn(h)}`, lb: qty * h * DECK.legLbPerIn });
  }
  const skirts = list.parts.filter((p) => p.kind === "skirt");
  for (const [len, qty] of count(skirts, (k) => k.length)) {
    const drop = skirts[0].drop;
    lines.push({ key: `skirt-${len}`, qty, item: `${SKIRT.label}, ${ftIn(len)} piece`, note: `${ftIn(drop)} drop, with clips`, lb: qty * (len / 12) * SKIRT.lbPerFt });
  }
  for (const [len, qty] of count(list.parts.filter((p) => p.kind === "rail"), (r) => r.length)) {
    lines.push({ key: `rail-${len}`, qty, item: `${RAIL.label}, ${ftIn(len)}`, note: `${RAIL.height}" tall`, lb: qty * (len / 12) * RAIL.lbPerFt });
  }
  const stairs = list.parts.filter((p) => p.kind === "stairs");
  for (const [risers, qty] of count(stairs, (x) => x.risers)) {
    const rise = stairs[0].rise;
    lines.push({ key: `stairs-${risers}`, qty, item: `${STAIRS.label}, ${risers - 1} steps`, note: `for a ${ftIn(rise)} deck top, ${ftIn(STAIRS.width)} wide`, lb: qty * (STAIRS.lb + (risers - 1) * STAIRS.lbPerStep) });
  }
  return lines;
}

export const totalWeight = (lines: readonly RentalLine[]) => lines.reduce((a, l) => a + l.lb, 0);

/** Plain text for a text message or email to the rental house. */
export function rentalText(name: string, lines: readonly RentalLine[]): string {
  const rows = lines.map((l) => `${l.qty} × ${l.item}${l.note ? ` (${l.note})` : ""}`);
  return [`${name} — rental list`, ...rows, `About ${Math.round(totalWeight(lines))} lb total.`].join("\n");
}
