import { test } from "node:test";
import assert from "node:assert/strict";
import { CONVERSIONS, FORMULA_GROUPS } from "./formulas.ts";
import { PRACTICE_SETS } from "./questions.ts";
import { solveBridle } from "../bridle/math.ts";

const ids = new Set(PRACTICE_SETS.flatMap((s) => s.questions.map((q) => q.id)));
const all = FORMULA_GROUPS.flatMap((g) => g.formulas);

test("formula ids are unique and every linked question exists", () => {
  assert.equal(new Set(all.map((f) => f.id)).size, all.length);
  const missing = all.flatMap((f) => (f.questions ?? []).filter((q) => !ids.has(q)).map((q) => `${f.id} → ${q}`));
  assert.deepEqual(missing, []);
});

test("continuous-truss shares add up to the whole load", () => {
  assert.equal(2 * (3 / 16) + 10 / 16, 1);
  assert.equal(2 * 0.4 + 2 * 1.1, 3); // in units of w·S, total = 3·w·S
});

test("the general bridle formulas agree with the calculator's solver", () => {
  const W = 1000, H1 = 4, H2 = 6, V1 = 10, V2 = 8, den = V1 * H2 + V2 * H1;
  const r = solveBridle({ span: 10, load: W, x: 4, drop: 10, rise: -2 });
  const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  close(r.left.tension, (W * Math.hypot(H1, V1) * H2) / den);
  close(r.right.tension, (W * Math.hypot(H2, V2) * H1) / den);
  close(r.left.verticalForce, (W * V1 * H2) / den);
  close(r.horizontalForce, (W * H1 * H2) / den);
});

test("conversion pairs are inverses of each other", () => {
  const v = (k: string) => Number(CONVERSIONS.find(([a]) => a === k)![1].replace(/,/g, "").split(" ")[0]);
  assert.ok(Math.abs(v("1 ft") * v("1 m") - 1) < 1e-4);
  assert.ok(Math.abs(v("1 kg") * v("1 lb") - 1) < 1e-3);
  assert.equal(v("1 in"), 25.4);
});
