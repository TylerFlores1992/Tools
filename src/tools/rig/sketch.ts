// Free-form rigs for Rig Studio (the pinned Claude page): every project starts blank and is drawn
// as truss runs, towers and hanging points, not from a template. A sketch compiles to the same
// build list the Vectorworks connector builds (docs/RIG-STUDIO.md).
//
// Inches; X right, Y away from the front, Z up, floor at Z = 0. A run goes from one joint CENTER
// to another along the truss centerline; the compiler puts the blocks at the joints and fills the
// rest with stock sections.
import { z } from "zod";
import { BASEPLATE, ROOF, SERIES, type SeriesId } from "./catalog.ts";
import { splitRun } from "./build.ts";
import { SPAN_LIMIT, type Finding } from "./checks.ts";
import { ftIn } from "./templates.ts";
import type { BuildList, Part, TrussRole, Vec3 } from "./types.ts";

export type SketchRun = { id: string; a: Vec3; b: Vec3; label?: string };
/** A ground-support tower (self-climbing). Its sleeve sits at the joint of the grid above it. */
export type SketchTower = { id: string; x: number; y: number; height?: number; label?: string };
/** A chain hoist or a dead-hung point. `capacity` in pounds. */
export type SketchPoint = { id: string; at: Vec3; kind: "hoist" | "deadhang"; capacity: number; label?: string };
/** Something hung on the rig that isn't truss: a speaker, a video wall, a fixture count. */
export type SketchLoad = { id: string; at: Vec3; lb: number; label: string };

export type Sketch = {
  version: 1;
  name: string;
  series: SeriesId;
  runs: SketchRun[];
  towers: SketchTower[];
  points: SketchPoint[];
  loads: SketchLoad[];
  /** What each tower may carry, lb. A planning figure unless the rental house's calcs say so. */
  towerLimit: number;
};

export const emptySketch = (name: string, series: SeriesId = "box12"): Sketch => ({
  version: 1, name, series, runs: [], towers: [], points: [], loads: [], towerLimit: ROOF.defaultLimit,
});

const num = z.number().finite();
const vec = z.tuple([num, num, num]);
const id = z.string().trim().min(1).max(40);
const SKETCH = z.object({
  version: z.literal(1).default(1),
  name: z.string().trim().min(1).max(80),
  series: z.enum(["box12", "box20"]),
  runs: z.array(z.object({ id, a: vec, b: vec, label: z.string().max(60).optional() })).max(2000).default([]),
  towers: z.array(z.object({ id, x: num, y: num, height: num.positive().max(1200).optional(), label: z.string().max(60).optional() })).max(200).default([]),
  points: z
    .array(z.object({ id, at: vec, kind: z.enum(["hoist", "deadhang"]).default("hoist"), capacity: num.positive().max(20000).default(2000), label: z.string().max(60).optional() }))
    .max(500)
    .default([]),
  loads: z.array(z.object({ id, at: vec, lb: num.nonnegative().max(50000), label: z.string().trim().min(1).max(60) })).max(2000).default([]),
  towerLimit: num.positive().max(20000).default(ROOF.defaultLimit),
});

/** Anything from the page, a session or Claude → a sketch, or the problems in words. */
export function readSketch(raw: unknown): { sketch: Sketch; problems: [] } | { sketch: null; problems: string[] } {
  const r = SKETCH.safeParse(raw);
  if (!r.success) return { sketch: null, problems: r.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "sketch"}: ${i.message}`) };
  const s = r.data as Sketch;
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const x of [...s.runs, ...s.towers, ...s.points, ...s.loads]) {
    if (seen.has(x.id)) problems.push(`id "${x.id}" is used twice`);
    seen.add(x.id);
  }
  for (const r of s.runs) if (dist(r.a, r.b) < 1) problems.push(`run ${r.id} is shorter than 1"`);
  for (const r of s.runs) if (Math.min(r.a[2], r.b[2]) < -0.01) problems.push(`run ${r.id} goes below the floor`);
  return problems.length ? { sketch: null, problems } : { sketch: s, problems: [] };
}

const TOL = 0.5;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4 + 0;
const v = (x: number, y: number, z: number): Vec3 => [r4(x), r4(y), r4(z)];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a: Vec3, b: Vec3) => Math.hypot(...sub(a, b));
const along = (a: Vec3, u: Vec3, t: number): Vec3 => v(a[0] + u[0] * t, a[1] + u[1] * t, a[2] + u[2] * t);
const unit = (d: Vec3): Vec3 => {
  const l = Math.hypot(...d);
  return [d[0] / l, d[1] / l, d[2] / l];
};
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The sleeve block of a self-climbing tower for a series: 28" on 20.5" box (the Air Pro roof), the truss plus 7.5" otherwise. */
export const sleeveSize = (series: SeriesId) => (series === "box20" ? ROOF.sleeve.size : SERIES[series].width + 7.5);

export type Joint = { at: Vec3; runs: { run: string; dir: Vec3 }[]; block: "none" | "corner" | "sleeve" | "end"; tower?: string };

export type Compiled = {
  list: BuildList;
  joints: Joint[];
  /** Build-list part id → the sketch element it came from (for picking and highlighting). */
  owner: Record<string, string>;
};

/** Sketch → build list: stock sections, corner blocks, sleeves, head blocks and tower bases. */
export function compileSketch(sk: Sketch): Compiled {
  const s = SERIES[sk.series];
  const w = s.width;
  const parts: Part[] = [];
  const notes: string[] = [];
  const owner: Record<string, string> = {};
  const n = { t: 0, c: 0, b: 0 };
  const stock = sk.series === "box20" ? [120, 60, 48, 96, 30, 24, 12, ...ROOF.spacers] : [...s.stock];

  // Joints: run ends that meet (within half an inch) are one joint.
  const joints: Joint[] = [];
  const jointAt = (p: Vec3) => {
    let j = joints.find((x) => dist(x.at, p) < TOL);
    if (!j) joints.push((j = { at: v(...p), runs: [], block: "none" }));
    return j;
  };
  const runs = sk.runs.filter((r) => dist(r.a, r.b) >= 1);
  for (const r of runs) {
    const u = unit(sub(r.b, r.a));
    jointAt(r.a).runs.push({ run: r.id, dir: u });
    jointAt(r.b).runs.push({ run: r.id, dir: [-u[0], -u[1], -u[2]] });
  }
  // A tower takes the highest joint above it as its sleeve.
  const sleeveOf = new Map<string, Joint>();
  for (const t of sk.towers) {
    const above = joints.filter((j) => Math.abs(j.at[0] - t.x) < TOL && Math.abs(j.at[1] - t.y) < TOL && j.at[2] > w);
    const top = above.sort((a, b) => b.at[2] - a.at[2])[0];
    if (top) {
      top.block = "sleeve";
      top.tower = t.id;
      sleeveOf.set(t.id, top);
    }
  }
  for (const j of joints) {
    if (j.block === "sleeve") continue;
    if (j.runs.length === 1) j.block = j.at[2] < TOL && Math.abs(j.runs[0].dir[2]) > 0.99 ? "end" : "none";
    else if (j.runs.length === 2 && dot(j.runs[0].dir, j.runs[1].dir) < -0.999) j.block = "none";
    else j.block = "corner";
  }
  const trimAt = (j: Joint) => (j.block === "corner" ? w / 2 : j.block === "sleeve" ? sleeveSize(sk.series) / 2 : 0);

  for (const j of joints) {
    if (j.block === "corner") {
      const id = `c${++n.c}`;
      parts.push({ id, kind: "corner", size: w, ways: j.runs.length, center: j.at });
      owner[id] = j.runs[0].run;
    }
    if (j.block === "end") {
      // A leg standing on the floor: a plate under it, its top at the floor (as the cube's legs).
      const id = `b${++n.b}`;
      parts.push({ id, kind: "baseplate", size: BASEPLATE.size, center: v(j.at[0], j.at[1], -BASEPLATE.thickness / 2) });
      owner[id] = j.runs[0].run;
    }
  }

  const fill = (a: Vec3, b: Vec3, role: TrussRole, label: string, src: string, st: readonly number[]) => {
    const len = dist(a, b);
    if (len < 0.25) return;
    const u = unit(sub(b, a));
    const { pieces, exact } = splitRun(len, st);
    if (!exact) {
      const got = pieces.reduce((x, y) => x + y, 0);
      notes.push(`${label}: no stock sections add up to ${r4(len)}" (closest is ${got}", ${r4(len - got)}" short).`);
    }
    let t = 0;
    for (const p of pieces) {
      const id = `t${++n.t}`;
      parts.push({ id, kind: "truss", role, length: p, start: along(a, u, t), end: along(a, u, t + p), roll: 0 });
      owner[id] = src;
      t += p;
    }
  };

  for (const r of runs) {
    const ja = jointAt(r.a);
    const jb = jointAt(r.b);
    const u = unit(sub(jb.at, ja.at));
    const L = dist(ja.at, jb.at);
    const ta = trimAt(ja);
    const tb = trimAt(jb);
    if (ta + tb >= L - 0.25) {
      notes.push(`Run ${r.label ?? r.id}: the blocks at its ends leave no room for truss (${ftIn(L)} joint to joint).`);
      continue;
    }
    const role: TrussRole = Math.abs(u[2]) > 0.99 ? "leg" : "grid";
    fill(along(ja.at, u, ta), along(ja.at, u, L - tb), role, `Run ${r.label ?? r.id}`, r.id, stock);
  }

  for (const t of sk.towers) {
    const j = sleeveOf.get(t.id);
    const base = ROOF.base.thickness;
    const zc = j?.at[2];
    const need = zc === undefined ? 0 : zc + w / 2 + ROOF.headroom - base;
    const mast = t.height ?? (zc === undefined ? 240 : Math.ceil(need / 120) * 120);
    if (t.height !== undefined && zc !== undefined && t.height < need - 0.01) {
      notes.push(`Tower ${t.label ?? t.id}: ${ftIn(t.height)} of mast is short of the ${ftIn(need)} its grid needs (with ${ftIn(ROOF.headroom)} above the truss for the sleeve).`);
    }
    if (zc === undefined) notes.push(`Tower ${t.label ?? t.id} has no truss joint above it, so it carries nothing.`);
    const bid = `b${++n.b}`;
    parts.push({ id: bid, kind: "baseplate", size: ROOF.base.size, center: v(t.x, t.y, base / 2) });
    owner[bid] = t.id;
    fill(v(t.x, t.y, base), v(t.x, t.y, base + mast), "tower", `Tower ${t.label ?? t.id}`, t.id, [120, 96, 60, 48, 30, 24, 12]);
    const hid = `c${++n.c}`;
    parts.push({ id: hid, kind: "corner", size: ROOF.head.size, ways: 1, center: v(t.x, t.y, base + mast + ROOF.head.thick / 2), role: "head", thick: ROOF.head.thick });
    owner[hid] = t.id;
    if (j) {
      const sid = `c${++n.c}`;
      parts.push({ id: sid, kind: "corner", size: sleeveSize(sk.series), ways: j.runs.length + 1, center: j.at, role: "sleeve" });
      owner[sid] = t.id;
    }
  }

  for (const r of runs) {
    const u = unit(sub(r.b, r.a));
    const level = Math.abs(u[2]) < 1e-3;
    const plumb = Math.abs(u[2]) > 1 - 1e-3;
    const square = level && (Math.abs(u[0]) < 1e-3 || Math.abs(u[1]) < 1e-3);
    if (!plumb && !square) notes.push(`Run ${r.label ?? r.id} isn't level along X or Y, or plumb: the Vectorworks connector can't build it yet.`);
  }

  return {
    list: {
      version: 1,
      name: sk.name,
      units: "in",
      series: { id: s.id, label: s.label, width: s.width, height: s.height, chordOd: s.chordOd, chordInset: s.chordInset },
      parts,
      notes,
    },
    joints,
    owner,
  };
}

export type Support = { id: string; kind: "hoist" | "deadhang" | "tower"; at: Vec3; capacity: number; lb: number; label: string };

/** Weight of a part as the rig carries it (towers, bases and head blocks stand on the floor). */
function partWeight(p: Part, series: SeriesId): { at: Vec3; lb: number } | null {
  const s = SERIES[series];
  if (p.kind === "truss") {
    if (p.role === "tower" || p.role === "leg") return null;
    return { at: v((p.start[0] + p.end[0]) / 2, (p.start[1] + p.end[1]) / 2, (p.start[2] + p.end[2]) / 2), lb: (p.length / 12) * s.lbPerFt };
  }
  if (p.kind === "corner") {
    if (p.role === "head") return null;
    return { at: p.center, lb: p.role === "sleeve" ? ROOF.sleeve.lb : s.cornerLb };
  }
  return null;
}

/**
 * What each hanging point and tower carries: every piece of truss, block and hung load goes to the
 * nearest two supports, shared by inverse distance. Planning arithmetic only (no continuity, no
 * dynamic factor); the page says so. `extra` adds loads from reference layers (fixtures).
 */
export function sketchLoads(sk: Sketch, c: Compiled, extra: SketchLoad[] = []): { supports: Support[]; total: number; unsupported: number } {
  const supports: Support[] = [
    ...sk.points.map((p) => ({ id: p.id, kind: p.kind, at: p.at, capacity: p.capacity, lb: 0, label: p.label ?? p.id })),
    ...sk.towers.flatMap((t) => {
      const j = c.joints.find((x) => x.tower === t.id);
      return j ? [{ id: t.id, kind: "tower" as const, at: j.at, capacity: sk.towerLimit, lb: 0, label: t.label ?? t.id }] : [];
    }),
  ];
  const masses = [
    ...c.list.parts.flatMap((p) => {
      const m = partWeight(p, sk.series);
      return m ? [m] : [];
    }),
    ...sk.loads,
    ...extra,
  ];
  let total = 0;
  let unsupported = 0;
  for (const m of masses) {
    total += m.lb;
    if (!supports.length) {
      unsupported += m.lb;
      continue;
    }
    const near = supports.map((s) => ({ s, d: dist(s.at, m.at) })).sort((a, b) => a.d - b.d);
    const [a, b] = near;
    if (!b || a.d < 1) a.s.lb += m.lb;
    else {
      a.s.lb += (m.lb * b.d) / (a.d + b.d);
      b.s.lb += (m.lb * a.d) / (a.d + b.d);
    }
  }
  for (const s of supports) s.lb = Math.round(s.lb * 10) / 10;
  return { supports, total: Math.round(total * 10) / 10, unsupported: Math.round(unsupported * 10) / 10 };
}

/** The longest stretch of each run with nothing holding it up, as positions along the run. */
function longestGap(r: SketchRun, holds: Vec3[], fixedEnds: [boolean, boolean]): { gap: number; free: number } {
  const L = dist(r.a, r.b);
  const u = unit(sub(r.b, r.a));
  const ts = holds
    .map((p) => {
      const t = dot(sub(p, r.a), u);
      const off = dist(p, along(r.a, u, t));
      return t >= -1 && t <= L + 1 && off < 24 ? Math.min(L, Math.max(0, t)) : null;
    })
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  if (fixedEnds[0]) ts.unshift(0);
  if (fixedEnds[1]) ts.push(L);
  if (!ts.length) return { gap: L, free: 0 };
  let gap = 0;
  for (let i = 1; i < ts.length; i++) gap = Math.max(gap, ts[i] - ts[i - 1]);
  return { gap, free: Math.max(ts[0], L - ts[ts.length - 1]) };
}

/** Planning checks for a sketch, words first with a level for the glyph (the owner is colour-blind). */
export function sketchChecks(sk: Sketch, c: Compiled, extra: SketchLoad[] = []): Finding[] {
  const out: Finding[] = c.list.notes.map((t, i) => ({ id: `note-${i}`, level: "warn" as const, text: t }));
  if (!sk.runs.length && !sk.towers.length) return [{ id: "empty", level: "note", text: "Nothing drawn yet." }];
  const { supports, total, unsupported } = sketchLoads(sk, c, extra);
  if (unsupported > 0) out.push({ id: "none", level: "warn", text: `No hoists, dead-hangs or towers yet: ${Math.round(unsupported)} lb has nothing holding it up.` });
  for (const s of supports) {
    if (s.lb > s.capacity) out.push({ id: `over-${s.id}`, level: "warn", text: `${s.label} carries about ${Math.round(s.lb)} lb, over its ${Math.round(s.capacity)} lb.` });
  }
  const over = supports.filter((s) => s.lb > s.capacity).length;
  if (supports.length && !over) {
    const worst = [...supports].sort((a, b) => b.lb / b.capacity - a.lb / a.capacity)[0];
    out.push({ id: "points", level: "ok", text: `Every point is under its limit; the busiest is ${worst.label} at about ${Math.round(worst.lb)} of ${Math.round(worst.capacity)} lb.` });
  }
  if (supports.some((s) => s.kind === "tower") && sk.towerLimit === ROOF.defaultLimit) {
    out.push({ id: "tower-limit", level: "note", text: `Tower limit is ${ROOF.defaultLimit} lb, a planning figure (a 1-ton climbing hoist). Use the rental house's calcs before show day.` });
  }
  const limit = SPAN_LIMIT[sk.series];
  const holds = supports.map((s) => s.at);
  let worstGap = { gap: 0, run: "" };
  let worstFree = { free: 0, run: "" };
  for (const r of sk.runs) {
    const u = unit(sub(r.b, r.a));
    if (Math.abs(u[2]) > 0.99) continue;
    const ends: [boolean, boolean] = [r.a, r.b].map((p) => {
      const j = c.joints.find((x) => dist(x.at, p) < TOL);
      return !!j && j.runs.length > 1;
    }) as [boolean, boolean];
    const { gap, free } = longestGap(r, holds, ends);
    if (gap > worstGap.gap) worstGap = { gap, run: r.label ?? r.id };
    if (free > worstFree.free) worstFree = { free, run: r.label ?? r.id };
  }
  if (worstGap.gap > limit) out.push({ id: "span", level: "warn", text: `Run ${worstGap.run} goes ${ftIn(worstGap.gap)} between points, past ${ftIn(limit)}: check the truss maker's load table or add a point.` });
  else if (worstGap.gap > 0 && supports.length) out.push({ id: "span", level: "ok", text: `Longest stretch between points is ${ftIn(worstGap.gap)}, inside ${ftIn(limit)}.` });
  if (worstFree.free > 48) out.push({ id: "cantilever", level: "warn", text: `Run ${worstFree.run} hangs ${ftIn(worstFree.free)} past its last point: keep cantilevers short or add a point.` });
  out.push({ id: "weight", level: "note", text: `About ${Math.round(total)} lb on the rig in all (truss, blocks and listed loads). Planning figures, not engineering.` });
  return out;
}

/** Hoists and dead-hangs for the rental list (truss and blocks come from rentalList). */
export function pointLines(sk: Sketch): { key: string; qty: number; item: string; note?: string; lb: number }[] {
  const m = new Map<string, number>();
  for (const p of sk.points) {
    const k = `${p.kind}-${p.capacity}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([k, qty]) => {
    const [kind, cap] = k.split("-");
    const c = Number(cap);
    const size = c % 2000 === 0 ? `${c / 2000} ton` : c === 1000 ? "½ ton" : c === 500 ? "¼ ton" : `${c} lb`;
    return kind === "hoist"
      ? { key: k, qty, item: `Chain hoist, ${size}`, note: "with a span set and shackles", lb: qty * (c >= 2000 ? 140 : 80) }
      : { key: k, qty, item: "Dead-hang point (steel and shackles)", note: `rated ${c} lb`, lb: qty * 15 };
  });
}

/**
 * A roof template design as a sketch (towers down both long sides, beams, cross beams, spine), so
 * a Rig Planner roof (the Air Pro self-climber) can open in Rig Studio. Compiles to the same parts.
 */
export function sketchFromRoof(name: string, p: { series: SeriesId; width: number; depth: number; trim: number; bays: number[]; spine: boolean; towerLimit: number }): Sketch {
  const s = SERIES[p.series];
  const zc = p.trim + s.width / 2;
  const D = p.depth;
  const xs = p.bays.reduce((acc, b) => [...acc, acc[acc.length - 1] + b], [0]);
  const sk = emptySketch(name, p.series);
  sk.towerLimit = p.towerLimit;
  let k = 0;
  const run = (a: Vec3, b: Vec3, label: string) => sk.runs.push({ id: `r${++k}`, a, b, label });
  for (const [y, side] of [[0, "Front"], [D, "Back"]] as const) {
    for (let i = 0; i < xs.length - 1; i++) run([xs[i], y, zc], [xs[i + 1], y, zc], `${side} beam ${i + 1}`);
    for (const [i, x] of xs.entries()) sk.towers.push({ id: `${side[0].toLowerCase()}t${i + 1}`, x, y, label: `${side} tower ${i + 1}` });
  }
  for (const [i, x] of xs.entries()) {
    if (p.spine) {
      run([x, 0, zc], [x, D / 2, zc], `Cross beam ${i + 1} front`);
      run([x, D / 2, zc], [x, D, zc], `Cross beam ${i + 1} back`);
    } else run([x, 0, zc], [x, D, zc], `Cross beam ${i + 1}`);
  }
  if (p.spine) for (let i = 0; i < xs.length - 1; i++) run([xs[i], D / 2, zc], [xs[i + 1], D / 2, zc], `Spine ${i + 1}`);
  return sk;
}
