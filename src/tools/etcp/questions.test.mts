/**
 * The practice tests are only worth anything if the answer key is right. Every numeric answer is
 * recomputed here from first principles (bridles through the same solver the calculator uses),
 * and the keyed option must be the one, and only one, that matches.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARENA_OUTLINE, AREAS, PRACTICE_SETS, type Area, type Question } from "./questions.ts";
import { solveBridle } from "../bridle/math.ts";

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const KG_LB = 2.2046, M_FT = 3.2808, KN_LBF = 224.8;

/** Recomputed value for every question whose answer is a number. */
const EXPECTED: Record<string, number> = {
  a01: solveBridle({ span: 20, load: 1000, x: 10, drop: 10, rise: 0 }).left.tension,
  a02: 2 * deg(Math.acos(0.5)), // T = W when (W/2)/cos θ = W → θ = 60° from vertical
  a03: solveBridle({ span: 12, load: 2000, x: 4, drop: 6, rise: 0 }).left.tension,
  a04: solveBridle({ span: 12, load: 2000, x: 4, drop: 6, rise: 0 }).right.verticalForce,
  a05: Math.hypot(9, 12),
  a06: 500 * KG_LB,
  a07: 12 * M_FT,
  a08: 14400 / 8,
  a09: (9800 * 0.8) / 8,
  a10: 12 / 0.5,
  a11: 1000 * (1 + 24 / 2),
  a12: (2000 * 15) / 20,
  a13: (25 * 40) / 2 + (300 * 30) / 40,
  a14: (10 / 16) * 2400,
  a15: (600 * 15 + 400 * 5 + 200 * 25) / 1200,
  a16: (800 * 5) / 15,
  a17: deg(Math.atan(1 / 40)),
  a24: 5000,
  b01: solveBridle({ span: 16, load: 1200, x: 8, drop: 6, rise: 0 }).left.tension,
  b02: solveBridle({ span: 16, load: 1200, x: 8, drop: 6, rise: 0 }).horizontalForce,
  // Beam A at 50 ft, B at 48 ft, apex at 40 ft: drop 10 below A, B is 2 ft lower.
  b03: solveBridle({ span: 10, load: 1000, x: 4, drop: 10, rise: -2 }).left.tension,
  b04: solveBridle({ span: 10, load: 1000, x: 4, drop: 10, rise: -2 }).left.length,
  b05: 2 * KN_LBF,
  b06: 3500 / KG_LB,
  b07: 4200 / 10,
  b08: (1500 * 8) / 0.9,
  b09: 500 * (1 + 6 / 1),
  b10: (1000 * 20) / 30 + (600 * 10) / 30,
  b11: (600 * 15 + 150 * 30) / 24,
  b12: (1.1 / 3) * 3000,
  b13: 4 * Math.sin(rad(15)),
  b14: 2 * deg(Math.atan(5 / 12)),
  b15: 500 / Math.sin(rad(30)),
  b16: 1.5,
  b22: 6,
  b25: 80,
  c01: 30 * 12 + 2 * 140 + 12 * 38 + (30 + 40) * 0.6,
  c02: 1.5 * 1000 * KG_LB,
  c03: (15 * KG_LB) / M_FT,
  c04: 2000 * Math.sin(rad(30)),
  c05: Math.hypot(6, 8, 24),
  c06: (200 * Math.sin(rad(60))) / Math.sin(rad(30)),
  c07: threeWay([[0, 0], [20, 0], [10, 15]], [10, 5], 12, 2000)[0],
  c10: 7000 / 875,
  c11: (1200 * 6) / 8,
  c13: 6 + 3.5 + 1 + 5 + 2,
  c14: 1800, // 29 CFR 1910.140(d)(1)(i)
  c15: 5.5 * 4,
  c21: 9500 * 0.5, // Crosby side-load table: 90° → 50%
  c27: 30, // Crosby shouldered eye bolt at 45°
  c39: 36, // 3 ft, 1910.23(c)(11)
  c43: 400 / 4,
  c48: (4200 * 1.0) / 8,
};

/**
 * Leg tensions of a bridle with any number of legs meeting at one apex, solved as 3-D statics
 * (Gaussian elimination, so three legs only). Points share a height; the apex hangs `drop` below.
 */
function threeWay(points: [number, number][], apex: [number, number], drop: number, W: number): number[] {
  const u = points.map(([x, y]) => {
    const v = [x - apex[0], y - apex[1], drop];
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  });
  // Columns are unit vectors; solve Σ T·u = (0, 0, W).
  const m = [0, 1, 2].map((r) => [u[0][r], u[1][r], u[2][r], r === 2 ? W : 0]);
  for (let c = 0; c < 3; c++) {
    const p = m.findIndex((row, i) => i >= c && Math.abs(row[c]) > 1e-12);
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < 3; r++) if (r !== c) {
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[3] / row[i]);
}

/** "Which of the following" and put-in-order questions: the list each option must spell out. */
const LISTS: Record<string, number[]> = {
  c19: [1, 2, 4],
  c29: [1, 3, 2, 4],
  c46: [1, 2, 3],
};
const listOf = (s: string) => s.match(/\d+/g)!.map(Number);


/** The leading number in an option: "1,602 lb" → 1602, "24:1" → 24, "1.43°" → 1.43. */
const num = (s: string) => {
  const m = s.replace(/,/g, "").match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};
/** Matches at the precision the option is written to (±1 in its last digit, for rounding). */
function matches(option: string, value: number) {
  const n = num(option);
  if (Number.isNaN(n)) return false;
  const decimals = (option.replace(/,/g, "").match(/^-?\d+\.(\d+)/)?.[1] ?? "").length;
  return Math.abs(n - value) <= 10 ** -decimals;
}

const all: Question[] = PRACTICE_SETS.flatMap((s) => [...s.questions]);

test("the high/low bridle setup matches the question (B is 2 ft lower, apex 10 ft below A)", () => {
  const r = solveBridle({ span: 10, load: 1000, x: 4, drop: 10, rise: -2 });
  assert.equal(r.right.vertical, 8);
  assert.ok(Math.abs(r.left.verticalForce - 652.2) < 0.1);
  assert.ok(Math.abs(r.right.tension - 434.8) < 0.1);
});

test("the 3-way bridle solver balances the load and matches the hand working", () => {
  const T = threeWay([[0, 0], [20, 0], [10, 15]], [10, 5], 12, 2000);
  // Apex on the centroid: each point takes a third of the load vertically.
  assert.ok(Math.abs((T[0] * 12) / Math.hypot(10, 5, 12) - 2000 / 3) < 1e-9);
  assert.ok(Math.abs((T[2] * 12) / Math.hypot(0, 10, 12) - 2000 / 3) < 1e-9);
  assert.ok(Math.abs(T[0] - T[1]) < 1e-9);
});

test("the overhang question's key matches moments about point 1 (uplift at point 2)", () => {
  const W = 300, d = 4, S = 12;
  const r2 = (-d * W) / S, r1 = W - r2;
  assert.equal(r2, -100);
  assert.equal(r1, 400);
  const q = all.find((x) => x.id === "c08")!;
  assert.equal(q.options[q.answer], "Point 1: 400 lb; point 2: 100 lb of uplift");
});

test("list and sequence questions: exactly one option spells out the key", () => {
  for (const [id, want] of Object.entries(LISTS)) {
    const q = all.find((x) => x.id === id)!;
    const hits = q.options.map((o, i) => (JSON.stringify(listOf(o)) === JSON.stringify(want) ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(hits, [q.answer], id);
  }
});

test("clip table (Crosby G-450, 1/2 in rope): 3 clips, 11-1/2 in turnback is the key", () => {
  const q = all.find((x) => x.id === "c22")!;
  assert.equal(q.options[q.answer], "3 clips, 11-1/2 in");
});

test("test C is weighted like the real Arena exam: each area within one question of its share", () => {
  const c = PRACTICE_SETS.find((s) => s.slug === "c")!.questions;
  assert.ok(c.every((q) => q.area), "every question in C has an area");
  const total = Object.values(ARENA_OUTLINE).reduce((a, b) => a + b, 0);
  assert.equal(total, 150);
  for (const a of Object.keys(AREAS) as Area[]) {
    const share = (ARENA_OUTLINE[a] / total) * c.length;
    const n = c.filter((q) => q.area === a).length;
    assert.ok(Math.abs(n - share) <= 1, `${a}: ${n} questions, share ${share.toFixed(1)}`);
  }
});

test("sets of 25, 25 and 50, unique ids, four distinct options, a valid key and an explanation", () => {
  assert.deepEqual(PRACTICE_SETS.map((s) => s.questions.length), [25, 25, 50]);
  assert.equal(new Set(all.map((q) => q.id)).size, all.length);
  for (const q of all) {
    assert.equal(new Set(q.options).size, 4, `${q.id} has duplicate options`);
    assert.ok(q.answer >= 0 && q.answer <= 3, q.id);
    assert.ok(q.explain.length > 20, `${q.id} needs an explanation`);
  }
});

test("every numeric answer key is the one option matching the recomputed value", () => {
  const bad: string[] = [];
  for (const [id, value] of Object.entries(EXPECTED)) {
    const q = all.find((x) => x.id === id);
    if (!q) { bad.push(`${id}: no such question`); continue; }
    const hits = q.options.map((o, i) => (matches(o, value) ? i : -1)).filter((i) => i >= 0);
    if (hits.length !== 1 || hits[0] !== q.answer) bad.push(`${id}: expected ${value.toFixed(3)}, keyed "${q.options[q.answer]}", matching options ${JSON.stringify(hits.map((i) => q.options[i]))}`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("the checker itself catches a wrong key (self-test)", () => {
  assert.ok(matches("1,602 lb", 1602.4));
  assert.ok(!matches("1,333 lb", 1602.4));
  assert.ok(matches("1.43°", 1.432));
  assert.ok(!matches("1.43°", 1.45));
});

test("every question with a number in its key is recomputed above", () => {
  // Options that are all numbers mean a calculation; those must have an EXPECTED entry.
  const handChecked = new Set([...Object.keys(LISTS), "c22"]);
  const missing = all.filter((q) => q.options.every((o) => !Number.isNaN(num(o))) && !(q.id in EXPECTED) && !handChecked.has(q.id)).map((q) => q.id);
  // Recall facts with numeric options (anchor rating, fleet angle limit, free-fall limit, choker
  // %) are listed in EXPECTED as the published values.
  assert.deepEqual(missing, [], `numeric questions without a recomputation: ${missing.join(", ")}`);
});
