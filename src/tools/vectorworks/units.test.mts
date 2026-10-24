import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatArea, formatLength, INCHES, isImperial, nudgeSteps, parseLength, snap, type Units } from "./units.ts";

const MM: Units = { unit_name: "mm", units_per_inch: 25.4 };
const M: Units = { unit_name: "m", units_per_inch: 0.0254 };

// Shared with the connector's Python tests (vwmcp-win/tests/test_units.py reads the same file).
const CASES: { input: string; units: "in" | "mm"; expect: number | null }[] = JSON.parse(
  readFileSync(join(import.meta.dirname, "length-cases.json"), "utf8"),
);

test("parseLength reads every shared case the same way the bridge does", () => {
  for (const c of CASES) {
    const got = parseLength(c.input, c.units === "in" ? INCHES : MM);
    if (c.expect === null) assert.equal(got, null, c.input);
    else assert.ok(got !== null && Math.abs(got - c.expect) < 1e-6, `${c.input} → ${got}, want ${c.expect}`);
  }
});

test("parseLength never turns nonsense into 0", () => {
  for (const s of ["", "abc", "12'x", "1/0\"", "--3", "5 parsecs"]) assert.equal(parseLength(s, INCHES), null, s);
});

test("formatLength reads like a rigger writes it", () => {
  assert.equal(formatLength(150.5, INCHES), `12'-6 1/2"`);
  assert.equal(formatLength(144, INCHES), `12'-0"`);
  assert.equal(formatLength(0.5, INCHES), `1/2"`);
  assert.equal(formatLength(6.25, INCHES), `6 1/4"`);
  assert.equal(formatLength(-18, INCHES), `-1'-6"`);
  assert.equal(formatLength(11.99, INCHES), `1'-0"`); // rounds to the 16th, carries into feet
  assert.equal(formatLength(3810, MM), "3,810 mm");
  assert.equal(formatLength(12_500, MM), "12.5 m");
  assert.equal(formatLength(3.81, M), "3,810 mm");
  assert.equal(formatLength(Number.NaN, INCHES), "–");
  assert.equal(formatLength(null, INCHES), "–");
});

test("format then parse returns the same length (to the 16th)", () => {
  for (let i = 0; i < 500; i++) {
    const v = Math.round(Math.random() * 20_000) / 16;
    assert.equal(parseLength(formatLength(v, INCHES), INCHES), v);
  }
});

test("areas, unit families, steps and snapping", () => {
  assert.equal(formatArea(144 * 200, INCHES), "200 sq ft");
  assert.equal(formatArea(1_000_000, MM), "1 m²");
  assert.equal(isImperial(INCHES), true);
  assert.equal(isImperial({ unit_name: "'", units_per_inch: 1 / 12 }), true);
  assert.equal(isImperial(MM), false);
  assert.deepEqual(nudgeSteps(INCHES).map((s) => s.value), [1, 6, 12]);
  assert.deepEqual(nudgeSteps(MM).map((s) => Math.round(s.value)), [10, 100, 1000]);
  assert.equal(snap(13.4, 6), 12);
  assert.equal(snap(13.4, 0), 13.4);
});
