// Design → build list: every truss section, corner block, pipe and cheeseborough in 3D.
// Inches; X right, Y away from the front, Z up, floor at Z = 0 (docs/RIG.md).
import { BASEPLATE, CLAMP, PIPE, PIPE_STICKOUT, SERIES, type TrussSeries } from "./catalog.ts";
import type { BuildList, Part, RigDesign, TrussRole, Vec3 } from "./types.ts";

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
  private n = { t: 0, c: 0, p: 0, k: 0, b: 0 };
  constructor(readonly s: TrussSeries) {}

  corner(center: Vec3, ways: number) {
    this.parts.push({ id: `c${++this.n.c}`, kind: "corner", size: this.s.width, ways, center: v(...center) });
  }

  /** Sticks along a straight run from `a` to `b` (centerline points on the faces of what they join). */
  run(a: Vec3, b: Vec3, role: TrussRole, label: string) {
    const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(...d);
    const unit = scale(d, 1 / len);
    const { pieces, exact } = splitRun(len, this.s.stock);
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

  baseplate(center: Vec3) {
    this.parts.push({ id: `b${++this.n.b}`, kind: "baseplate", size: BASEPLATE.size, center: v(...center) });
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
    if (a1 + s > a2 - s + 1e-6 || s > zt - zb) {
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
