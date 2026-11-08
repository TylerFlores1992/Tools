// Design → build list: every truss section, corner block, pipe and cheeseborough in 3D.
// Inches; X right, Y away from the front, Z up, floor at Z = 0 (docs/RIG.md).
import { BASEPLATE, CLAMP, DECK, PIPE, PIPE_STICKOUT, RAIL, ROOF, SERIES, SKIRT, STAIRS, type TrussSeries } from "./catalog.ts";
import { fitBays, ftIn } from "./templates.ts";
import type { BuildList, Part, RigDesign, RigParams, TrussRole, Vec3 } from "./types.ts";

const R2 = Math.SQRT1_2;
const round = (n: number) => Math.round(n * 1e4) / 1e4 + 0; // + 0 turns -0 into 0
const v = (x: number, y: number, z: number): Vec3 => [round(x), round(y), round(z)];
const add = (a: Vec3, b: Vec3): Vec3 => v(a[0] + b[0], a[1] + b[1], a[2] + b[2]);
const scale = (a: Vec3, k: number): Vec3 => v(a[0] * k, a[1] * k, a[2] * k);

/**
 * Fewest stock sections that add up to exactly `length`. If no combination is exact, the longest
 * combination that fits (and `exact: false`).
 */
export function splitRun(length: number, stock: readonly number[]): { pieces: number[]; exact: boolean } {
  const L = Math.round(length * 2); // half-inch grid
  const s = stock.map((x) => Math.round(x * 2));
  if (L <= 0) return { pieces: [], exact: L === 0 };
  const best: (number[] | null)[] = Array(L + 1).fill(null);
  best[0] = [];
  for (let i = 1; i <= L; i++) {
    for (const p of s) {
      const prev = i - p >= 0 ? best[i - p] : null;
      if (prev && (!best[i] || prev.length + 1 < best[i]!.length)) best[i] = [...prev, p];
    }
  }
  for (let i = L; i >= 0; i--) {
    if (best[i]) return { pieces: [...best[i]!].sort((a, b) => b - a).map((x) => x / 2), exact: i === L };
  }
  return { pieces: [], exact: false };
}

class Builder {
  parts: Part[] = [];
  notes: string[] = [];
  private n = { t: 0, c: 0, p: 0, k: 0, b: 0, d: 0, l: 0, s: 0, r: 0, st: 0 };
  constructor(readonly s: TrussSeries) {}

  corner(center: Vec3, ways: number, extra: { role?: "sleeve" | "head"; size?: number; thick?: number } = {}) {
    const { size = this.s.width, ...rest } = extra;
    this.parts.push({ id: `c${++this.n.c}`, kind: "corner", size, ways, center: v(...center), ...rest });
  }

  /** Sticks along a straight run from `a` to `b` (centerline points on the faces of what they join). */
  run(a: Vec3, b: Vec3, role: TrussRole, label: string, stock: readonly number[] = this.s.stock) {
    const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(...d);
    const unit = scale(d, 1 / len);
    const { pieces, exact } = splitRun(len, stock);
    if (!exact) {
      const got = pieces.reduce((x, y) => x + y, 0);
      this.notes.push(`${label}: no stock sections add up to ${round(len)}" — closest is ${got}" (${round(len - got)}" short).`);
    }
    let at = a;
    for (const p of pieces) {
      const end = add(at, scale(unit, p));
      this.parts.push({ id: `t${++this.n.t}`, kind: "truss", role, length: p, start: at, end, roll: 0 });
      at = end;
    }
  }

  baseplate(center: Vec3, size: number = BASEPLATE.size) {
    this.parts.push({ id: `b${++this.n.b}`, kind: "baseplate", size, center: v(...center) });
  }

  /**
   * A ground-support roof: self-climbing towers down both long sides (centers at x = 0 and the
   * bay sums, y = 0 and D), a sleeve block at the grid in each, long beams between sleeves, a cross
   * beam at every tower and, optionally, a spine down the middle tied in with corner blocks.
   * Built like the Air Pro self-climber drawing (2022), whose numbers the tests check.
   */
  roof(p: RigParams) {
    const w = this.s.width;
    const h = w / 2;
    const D = p.depth;
    const zc = p.trim + h;
    const bays = fitBays(p.bays, p.towers, p.width);
    const xs = bays.reduce((acc, b) => [...acc, acc[acc.length - 1] + b], [0]);
    // Standard sections first, then the spacers that make a run exact; 10', 5', 4' are preferred
    // over 8' + 1' when both use as many pieces (that's how the Air Pro cross beams were built).
    const stock = [120, 60, 48, 96, 30, 24, 12, ...ROOF.spacers].filter((x, i, a) => a.indexOf(x) === i);
    const sl = ROOF.sleeve.size / 2;
    const need = p.trim + w + ROOF.headroom - ROOF.base.thickness;
    const mast = Math.ceil(need / 120) * 120;
    for (const y of [0, D])
      for (const x of xs) {
        this.baseplate([x, y, ROOF.base.thickness / 2], ROOF.base.size);
        this.run([x, y, ROOF.base.thickness], [x, y, ROOF.base.thickness + mast], "tower", "Tower");
        this.corner([x, y, ROOF.base.thickness + mast + ROOF.head.thick / 2], 1, { role: "head", size: ROOF.head.size, thick: ROOF.head.thick });
        this.corner([x, y, zc], 3, { role: "sleeve", size: ROOF.sleeve.size });
      }
    for (const y of [0, D]) for (let k = 0; k < bays.length; k++) this.run([xs[k] + sl, y, zc], [xs[k + 1] - sl, y, zc], "beam", "Long beam", stock);
    for (const [k, x] of xs.entries()) {
      if (p.spine) {
        this.corner([x, D / 2, zc], k === 0 || k === xs.length - 1 ? 3 : 4);
        this.run([x, sl, zc], [x, D / 2 - h, zc], "cross", "Cross beam", stock);
        this.run([x, D / 2 + h, zc], [x, D - sl, zc], "cross", "Cross beam", stock);
      } else this.run([x, sl, zc], [x, D - sl, zc], "cross", "Cross beam", stock);
    }
    if (p.spine) for (let k = 0; k < bays.length; k++) this.run([xs[k] + h, D / 2, zc], [xs[k + 1] - h, D / 2, zc], "spine", "Spine", stock);
  }

  /** One deck and its legs, centered at (cx, cy) in plan, `length` along X (rotation 0) or Y (90). */
  deck(cx: number, cy: number, length: number, rotation: 0 | 90, height: number) {
    this.parts.push({ id: `d${++this.n.d}`, kind: "deck", width: DECK.width, length, rotation, height, at: v(cx, cy, height - DECK.frame) });
    const a = length / 2 - DECK.legInset;
    const b = DECK.width / 2 - DECK.legInset;
    const along = length > DECK.width ? [-a, 0, a] : [-a, a];
    for (const u of along)
      for (const w of [-b, b]) {
        const [dx, dy] = rotation === 0 ? [u, w] : [w, u];
        this.parts.push({ id: `l${++this.n.l}`, kind: "leg", height, at: v(cx + dx, cy + dy, 0) });
      }
  }

  /** Stock pieces along one deck edge, for skirting or rails. */
  edge(kind: "skirt" | "rail", a: Vec3, b: Vec3, stock: readonly number[], extra: number) {
    const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const unit = scale(d, 1 / Math.hypot(...d));
    let at = a;
    for (const len of splitRun(Math.hypot(...d), stock).pieces) {
      const end = add(at, scale(unit, len));
      if (kind === "skirt") this.parts.push({ id: `s${++this.n.s}`, kind, length: len, start: at, end, drop: extra });
      else this.parts.push({ id: `r${++this.n.r}`, kind, length: len, start: at, end, height: extra });
      at = end;
    }
  }

  stairs(x: number, surface: number) {
    const risers = Math.ceil(surface / STAIRS.maxRise - 1e-9);
    this.parts.push({ id: `st${++this.n.st}`, kind: "stairs", width: STAIRS.width, rise: surface, risers, run: (risers - 1) * STAIRS.tread, at: v(x, 0, 0), out: [0, -1, 0] });
  }

  /** A W × D stage of 4×8 decks (a 4×4 where 4' is left over), long sides whichever way needs fewer. */
  stage(p: RigParams) {
    const { width: W, depth: D, height: H } = p;
    const dw = DECK.width;
    const count = (along: number, across: number) => (across / dw) * (Math.floor(along / (2 * dw)) + (along % (2 * dw) ? 1 : 0));
    const alongX = count(W, D) <= count(D, W);
    const [along, across] = alongX ? [W, D] : [D, W];
    for (let r = 0; r < across / dw; r++) {
      const c = dw / 2 + r * dw;
      let u = 0;
      const put = (len: number) => {
        const m = u + len / 2;
        if (alongX) this.deck(m, c, len, 0, H);
        else this.deck(c, m, len, 90, H);
        u += len;
      };
      while (u + 2 * dw <= along + 1e-6) put(2 * dw);
      if (u < along - 1e-6) put(dw);
    }
    const S = H + DECK.top;
    if (p.skirt) {
      this.edge("skirt", [0, 0, S], [W, 0, S], SKIRT.stock, S);
      this.edge("skirt", [0, D, S], [0, 0, S], SKIRT.stock, S);
      this.edge("skirt", [W, 0, S], [W, D, S], SKIRT.stock, S);
    }
    if (p.rail !== "none") {
      this.edge("rail", [0, D, S], [W, D, S], RAIL.stock, RAIL.height);
      if (p.rail === "three") {
        this.edge("rail", [0, 0, S], [0, D, S], RAIL.stock, RAIL.height);
        this.edge("rail", [W, 0, S], [W, D, S], RAIL.stock, RAIL.height);
      }
    }
    // Stairs on the front edge: one in the middle, or one near each end.
    const inset = STAIRS.width / 2 + 6;
    if (p.stairs === 1) this.stairs(W / 2, S);
    else if (p.stairs >= 2) {
      if (W < 2 * STAIRS.width + 12) {
        this.notes.push(`Stairs: a ${ftIn(W)} front only has room for one ${ftIn(STAIRS.width)} stair unit.`);
        this.stairs(W / 2, S);
      } else {
        this.stairs(inset, S);
        this.stairs(W - inset, S);
      }
    }
  }

  /**
   * Knee braces on one vertical face. The face runs `U` long along `u` from `origin` (its outer
   * bottom corner), `H` tall; `out` points away from the rig. Braces clamp to the legs' inner
   * chords and to the top (or bottom) beam's inner chord, 45°.
   */
  faceBraces(f: { origin: Vec3; u: Vec3; out: Vec3; U: number; H: number }, which: { top: boolean; bottom: boolean }, length: number, label: string) {
    const { width: w, chordInset: inset } = this.s;
    const off = CLAMP.offset;
    const s = (length - 2 * PIPE_STICKOUT) * R2; // clamp spacing, along each axis
    const a1 = w - inset;
    const a2 = f.U - w + inset;
    const zt = f.H - w + inset;
    const zb = w - inset;
    const plane = off - inset; // pipe centerline sits this far outside the face
    const at = (u: number, z: number): Vec3 => add(add(add(f.origin, scale(f.u, u)), [0, 0, z]), scale(f.out, plane));
    const dir = (du: number, dz: number): Vec3 => add(scale(f.u, du * R2), [0, 0, dz * R2]);
    const normal = scale(f.out, -1);
    const UP: Vec3 = [0, 0, 1];
    // Both ends on one leg need room for two braces without crossing.
    const legRoom = which.top && which.bottom ? 2 * s : s;
    if (a1 + s > a2 - s + 1e-6 || legRoom > zt - zb + 1e-6) {
      this.notes.push(`${label}: a ${length}" brace pipe doesn't fit this face.`);
      return;
    }
    const brace = (legU: number, legZ: number, beamU: number, beamZ: number, du: number) => {
      // Pipe runs from the lower clamp up to the higher one; du is its direction along u.
      const lower = legZ < beamZ ? ([legU, legZ] as const) : ([beamU, beamZ] as const);
      const d = dir(du, 1);
      const start = add(at(lower[0], lower[1]), scale(d, -PIPE_STICKOUT));
      const end = add(start, scale(d, length));
      this.parts.push({ id: `p${++this.n.p}`, kind: "pipe", od: PIPE.od, length, start, end });
      const clamp = (pt: Vec3, chordDir: Vec3) =>
        this.parts.push({ id: `k${++this.n.k}`, kind: "clamp", type: "swivel", at: pt, pipeDir: d, chordDir: v(...chordDir), normal, offset: off });
      clamp(at(legU, legZ), UP);
      clamp(at(beamU, beamZ), f.u);
    };
    if (which.top) {
      brace(a1, zt - s, a1 + s, zt, 1);
      brace(a2, zt - s, a2 - s, zt, -1);
    }
    if (which.bottom) {
      brace(a1, zb + s, a1 + s, zb, -1);
      brace(a2, zb + s, a2 - s, zb, 1);
    }
  }
}

export function buildList(design: RigDesign): BuildList {
  const p = design.params;
  const s = SERIES[p.series];
  const b = new Builder(s);
  const w = s.width;
  const h = w / 2;
  const top = p.braces === "top" || p.braces === "both";
  const bottom = p.braces === "bottom" || p.braces === "both";

  const ring = (W: number, D: number, z: number, role: TrussRole, name: string, ways: number) => {
    const xs = [h, W - h];
    const ys = [h, D - h];
    for (const x of xs) for (const y of ys) b.corner([x, y, z], ways);
    for (const y of ys) b.run([w, y, z], [W - w, y, z], role, `${name} along the width`);
    for (const x of xs) b.run([x, w, z], [x, D - w, z], role, `${name} along the depth`);
  };

  switch (design.template) {
    case "cube": {
      const { width: W, depth: D, height: H } = p;
      ring(W, D, h, "floor", "Floor ring", 3);
      ring(W, D, H - h, "top", "Top ring", 3);
      for (const x of [h, W - h]) for (const y of [h, D - h]) b.run([x, y, w], [x, y, H - w], "leg", "Legs");
      if (top || bottom) {
        const which = { top, bottom };
        b.faceBraces({ origin: [0, 0, 0], u: [1, 0, 0], out: [0, -1, 0], U: W, H }, which, p.braceLength, "Front");
        b.faceBraces({ origin: [0, D, 0], u: [1, 0, 0], out: [0, 1, 0], U: W, H }, which, p.braceLength, "Back");
        b.faceBraces({ origin: [0, 0, 0], u: [0, 1, 0], out: [-1, 0, 0], U: D, H }, which, p.braceLength, "Left");
        b.faceBraces({ origin: [W, 0, 0], u: [0, 1, 0], out: [1, 0, 0], U: D, H }, which, p.braceLength, "Right");
      }
      break;
    }
    case "goalpost": {
      // Height is measured from the top of the base plates.
      const { width: W, height: H } = p;
      for (const x of [h, W - h]) {
        b.baseplate([x, h, -BASEPLATE.thickness / 2]);
        b.corner([x, h, H - h], 2);
        b.run([x, h, 0], [x, h, H - w], "leg", "Legs");
      }
      b.run([w, h, H - h], [W - w, h, H - h], "header", "Header");
      if (top) b.faceBraces({ origin: [0, 0, 0], u: [1, 0, 0], out: [0, -1, 0], U: W, H }, { top: true, bottom: false }, p.braceLength, "Goal post");
      break;
    }
    case "tower": {
      b.baseplate([h, h, -BASEPLATE.thickness / 2]);
      b.run([h, h, 0], [h, h, p.height], "mast", "Mast");
      break;
    }
    case "flown": {
      ring(p.width, p.depth, p.trim + h, "grid", "Grid", 2);
      break;
    }
    case "stage":
      b.stage(p);
      break;
    case "roof":
      b.roof(p);
      break;
  }

  return {
    version: 1,
    name: design.name,
    units: "in",
    series: { id: s.id, label: s.label, width: s.width, height: s.height, chordOd: s.chordOd, chordInset: s.chordInset },
    parts: b.parts,
    notes: b.notes,
  };
}
