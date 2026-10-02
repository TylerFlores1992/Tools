/**
 * The bridle maths against worked examples (the owner's practice-test questions, each derived
 * independently from the ETCP formula-sheet formulas) and physical invariants.
 * A wrong number here has physical consequences, so every case states where it comes from.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { convertInput, levelBeamTension, solveBridle } from "./math.ts";

const near = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a.toFixed(3)}, expected ${b} ±${tol}`);

test("symmetric bridle, 20 ft span, 10 ft drop, 1,000 lb → 707 lb per leg, 90° included", () => {
  const r = solveBridle({ span: 20, load: 1000, x: 10, drop: 10, rise: 0 });
  near(r.left.tension, 707.1, 0.1, "left");
  near(r.right.tension, 707.1, 0.1, "right");
  near(r.includedAngle, 90, 1e-9, "included angle");
});

test("asymmetric level bridle, 12 ft span, apex 4 ft from A, 6 ft drop, 2,000 lb → A leg 1,602 lb", () => {
  const r = solveBridle({ span: 12, load: 2000, x: 4, drop: 6, rise: 0 });
  near(r.left.tension, 1602.5, 0.5, "leg A tension");
  near(r.left.verticalForce, 1333.3, 0.1, "vertical force on beam A");
  near(r.right.verticalForce, 666.7, 0.1, "vertical force on beam B");
  near(r.left.length, 7.211, 0.001, "leg A length");
});

test("symmetric bridle, 16 ft span, 6 ft drop, 1,200 lb → 1,000 lb per leg and 800 lb inward pull", () => {
  const r = solveBridle({ span: 16, load: 1200, x: 8, drop: 6, rise: 0 });
  near(r.left.tension, 1000, 1e-6, "left");
  near(r.right.tension, 1000, 1e-6, "right");
  near(r.horizontalForce, 800, 1e-6, "horizontal force");
});

test("high/low bridle: beams at 50 ft and 48 ft, 10 ft apart, apex at 40 ft and 4 ft from A, 1,000 lb", () => {
  const r = solveBridle({ span: 10, load: 1000, x: 4, drop: 10, rise: -2 });
  near(r.left.tension, 702.4, 0.2, "leg A tension");
  near(r.right.tension, 434.8, 0.2, "leg B tension");
  near(r.left.length, 10.77, 0.01, "leg A length");
  near(r.right.length, 10, 1e-9, "leg B length");
  near(r.left.verticalForce, 652.2, 0.2, "vertical force on A");
});

test("at a 120° included angle each leg carries exactly the full load", () => {
  const drop = 1, half = Math.tan(Math.PI / 3) * drop;
  const r = solveBridle({ span: 2 * half, load: 500, x: half, drop, rise: 0 });
  near(r.includedAngle, 120, 1e-9, "included angle");
  near(r.left.tension, 500, 1e-9, "left = load");
});

test("invariants hold across many random rigs: verticals sum to the load, horizontals cancel", () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 500; i++) {
    const span = 2 + rnd() * 60, x = span * (0.05 + rnd() * 0.9), drop = 0.5 + rnd() * 30, rise = (rnd() - 0.5) * drop, load = rnd() * 5000;
    const r = solveBridle({ span, load, x, drop, rise });
    assert.ok(r.valid, "random rig should be valid");
    near(r.left.verticalForce + r.right.verticalForce, load, 1e-6 * Math.max(1, load), "vertical sum");
    near((r.left.tension * r.left.horizontal) / r.left.length, (r.right.tension * r.right.horizontal) / r.right.length, 1e-6 * Math.max(1, load), "horizontal balance");
    assert.ok(r.left.tension >= 0 && r.right.tension >= 0, "legs can only pull");
  }
});

test("level beams: the solver agrees with the hand formula on the ETCP sheet", () => {
  const i = { span: 21, load: 500, x: 9, drop: 12, rise: 0 };
  const r = solveBridle(i);
  near(r.left.tension, levelBeamTension(i.load, r.left.length, r.right.horizontal, i.span, i.drop), 1e-9, "left");
  near(r.right.tension, levelBeamTension(i.load, r.right.length, r.left.horizontal, i.span, i.drop), 1e-9, "right");
});

test("invalid geometry is reported in words and never turned into a number", () => {
  for (const bad of [
    { span: 10, load: 100, x: 0, drop: 5, rise: 0 },
    { span: 10, load: 100, x: 10, drop: 5, rise: 0 },
    { span: 10, load: 100, x: 4, drop: 0, rise: 0 },
    { span: 10, load: 100, x: 4, drop: 3, rise: -3 },
    { span: 0, load: 100, x: 0, drop: 3, rise: 0 },
  ]) {
    const r = solveBridle(bad);
    assert.equal(r.valid, false, JSON.stringify(bad));
    assert.ok(r.problem.length > 10, "explains the problem");
    assert.ok(Number.isNaN(r.left.tension) && Number.isNaN(r.horizontalForce), "no fake tension");
  }
});

test("switching units converts the rig instead of relabelling it, and round-trips", () => {
  const imp = { span: 21, load: 500, x: 9, drop: 12, rise: 1 };
  const met = convertInput(imp, "imperial", "metric");
  near(met.span, 6.4008, 1e-4, "span in m");
  near(met.load, 226.796, 1e-3, "load in kg");
  const back = convertInput(met, "metric", "imperial");
  for (const k of Object.keys(imp) as (keyof typeof imp)[]) near(back[k], imp[k], 1e-9, `round trip ${k}`);
  // Tension scales with the load unit only; angles don't change.
  const a = solveBridle(imp), b = solveBridle(met);
  near(b.left.tension, a.left.tension * 0.45359237, 1e-6, "tension converts with load");
  near(b.includedAngle, a.includedAngle, 1e-9, "angle unchanged");
});
