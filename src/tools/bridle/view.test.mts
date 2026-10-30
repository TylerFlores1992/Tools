/** The share URL and the status line: rounding, round trips, and never showing stale tensions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { convertInput, solveBridle } from "./math.ts";
import { FIX_FIELD, fromQuery, statusFor, toQuery } from "./view.ts";

test("share URL is rounded to the precision the inputs show", () => {
  const metric = convertInput({ span: 21, load: 500, x: 9, drop: 12, rise: 0 }, "imperial", "metric");
  assert.equal(toQuery(metric, "metric"), "span=6.4&load=227&x=2.7&drop=3.7&rise=0&u=metric");
});

test("share URL writes a level rig as rise=0, never rise=-0", () => {
  assert.match(toQuery({ span: 10, load: 100, x: 5, drop: 5, rise: -0.01 }, "imperial"), /rise=0&/);
});

test("share URL round-trips through fromQuery", () => {
  const input = { span: 12, load: 2000, x: 4, drop: 6, rise: -1.5 };
  assert.deepEqual(fromQuery(new URLSearchParams(toQuery(input, "imperial"))), { input, units: "imperial" });
});

test("fromQuery refuses a link with a missing or non-numeric value", () => {
  assert.equal(fromQuery(new URLSearchParams("span=12&load=2000&x=4&drop=6")), null);
  assert.equal(fromQuery(new URLSearchParams("span=12&load=abc&x=4&drop=6&rise=0")), null);
});

test("a measurement that can't be read blocks every result, even a valid one", () => {
  const r = solveBridle({ span: 20, load: 1000, x: 10, drop: 10, rise: 0 });
  assert.deepEqual(statusFor(r, 1000, true), { kind: "wrong", text: FIX_FIELD });
  assert.equal(statusFor(r, 1000, false).kind, "ok");
});

test("impossible geometry says why", () => {
  const r = solveBridle({ span: 10, load: 500, x: 0, drop: 5, rise: 0 });
  assert.deepEqual(statusFor(r, 500, false), { kind: "wrong", text: "Keep the bridle point between the two beams." });
});

test("a leg over the load is a caution, not an error, and names the leg", () => {
  const r = solveBridle({ span: 20, load: 1000, x: 4, drop: 1, rise: 0 });
  const s = statusFor(r, 1000, false);
  assert.equal(s.kind, "note");
  assert.ok(s.kind === "note" && s.caution);
  assert.match(s.text, /^The left leg carries more than the load/);
});

test("wide legs get a plain note; status texts carry no live numbers", () => {
  const r = solveBridle({ span: 20, load: 1000, x: 10, drop: 8, rise: 0 });
  const s = statusFor(r, 1000, false);
  assert.ok(s.kind === "note" && !s.caution);
  const wider = statusFor(solveBridle({ span: 20, load: 1000, x: 10, drop: 7, rise: 0 }), 1000, false);
  assert.equal(wider.text, s.text, "dragging must not change the words, or the live region re-announces");
});
