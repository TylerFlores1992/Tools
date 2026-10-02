/**
 * The practice tests are only worth anything if the answer key is right. Every numeric answer is
 * recomputed here from first principles (bridles through the same solver the calculator uses),
 * and the keyed option must be the one, and only one, that matches.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_SETS, type Question } from "./questions.ts";
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
};

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

test("two sets of 25, unique ids, four distinct options, a valid key and an explanation", () => {
  assert.deepEqual(PRACTICE_SETS.map((s) => s.questions.length), [25, 25]);
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
  const missing = all.filter((q) => q.options.every((o) => !Number.isNaN(num(o))) && !(q.id in EXPECTED)).map((q) => q.id);
  // Recall facts with numeric options (anchor rating, fleet angle limit, free-fall limit, choker
  // %) are listed in EXPECTED as the published values.
  assert.deepEqual(missing, [], `numeric questions without a recomputation: ${missing.join(", ")}`);
});
