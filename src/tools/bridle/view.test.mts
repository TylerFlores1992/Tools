/** The share URL and the status line: rounding, round trips, and never showing stale tensions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { convertInput, solveBridle } from "./math.ts";
import { FIX_FIELD, URL_WRITE_GAP_MS, fromQuery, loadNotes, statusFor, toQuery, urlWriteWait } from "./view.ts";

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

test("load notes: zero and a likely typo get a note; ordinary loads don't", () => {
  assert.match(loadNotes(0, "imperial")[0], /load is 0/);
  assert.deepEqual(loadNotes(500, "imperial"), []);
  assert.deepEqual(loadNotes(20000, "imperial"), [], "the threshold itself is fine");
  assert.match(loadNotes(999999, "imperial")[0], /20,000 lb/);
  assert.deepEqual(loadNotes(9000, "metric"), []);
  assert.match(loadNotes(10001, "metric")[0], /10,000 kg/);
});

test("the share URL is written at most about three times a second during a drag, and the last change lands", () => {
  // A 4 s drag at ~60 changes a second, run through the same rule the component uses.
  let last = -Infinity, pendingAt: number | null = null;
  const writes: number[] = [];
  const flushUntil = (t: number) => { if (pendingAt !== null && pendingAt <= t) { writes.push(pendingAt); last = pendingAt; pendingAt = null; } };
  for (let t = 0; t <= 4000; t += 1000 / 60) {
    flushUntil(t);
    pendingAt = null; // a new change replaces the scheduled write
    const wait = urlWriteWait(t, last);
    if (wait === 0) { writes.push(t); last = t; } else pendingAt = t + wait;
  }
  flushUntil(Infinity);
  assert.ok(writes.length <= Math.ceil(4000 / URL_WRITE_GAP_MS) + 2, `${writes.length} writes`);
  assert.ok(writes.length < 100, "stays under Safari's limit");
  assert.ok(writes.at(-1)! >= 4000, "the final position is written");
  for (let i = 1; i < writes.length; i++) assert.ok(writes[i] - writes[i - 1] >= URL_WRITE_GAP_MS - 1e-9);
});

test("the first change after a pause is written straight away", () => {
  assert.equal(urlWriteWait(10_000, 0), 0);
  assert.equal(urlWriteWait(100, 0), URL_WRITE_GAP_MS - 100);
});
