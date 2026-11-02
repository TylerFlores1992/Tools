import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, mergeFrames, newMemory } from "./detect.mjs";

const cfg = { pauseMs: 5000, videoGraceMs: 20_000, noNextMs: 60_000, lockedMs: 900_000, stuckClicks: 3 };
const page = (over = {}) => ({ question: false, video: "none", next: "ready", text: "a", url: "u", ...over });

test("a question always goes to the owner and never clicks", () => {
  const d = decide(page({ question: true }), newMemory(), 0, cfg);
  assert.equal(d.status, "needs-you");
  assert.equal(d.alert, "question");
  assert.equal(d.click, false);
});

test("waits out the pause, then clicks once", () => {
  const m = newMemory();
  assert.equal(decide(page(), m, 0, cfg).click, false);
  assert.equal(decide(page(), m, 4999, cfg).click, false);
  assert.equal(decide(page(), m, 5000, cfg).click, true);
});

test("never clicks a locked Next or during a video", () => {
  assert.equal(decide(page({ next: "locked" }), newMemory(), 0, cfg).click, false);
  const m = newMemory();
  for (const t of [0, 6000, 12000]) assert.equal(decide(page({ video: "playing" }), m, t, cfg).click, false);
});

test("calls the owner only after the grace period", () => {
  const m = newMemory();
  assert.equal(decide(page({ video: "paused" }), m, 0, cfg).status, "running");
  assert.equal(decide(page({ video: "paused" }), m, 20_000, cfg).alert, "video");
  const n = newMemory();
  assert.equal(decide(page({ next: "none" }), n, 0, cfg).status, "running");
  assert.equal(decide(page({ next: "none" }), n, 60_000, cfg).alert, "no-next");
});

test("stops clicking a Next that changes nothing", () => {
  const m = newMemory();
  let clicks = 0, last, t = 0;
  for (let i = 0; i < 12; i++) { last = decide(page(), m, (t += 5000), cfg); if (last.click) clicks++; }
  assert.ok(clicks <= 4, `clicked ${clicks} times`);
  assert.equal(last.alert, "stuck");
});

test("a page that changes keeps going", () => {
  const m = newMemory();
  let clicks = 0;
  for (let i = 0; i < 40; i++) if (decide(page({ text: String(i) }), m, i * 5000, cfg).click) clicks++;
  assert.ok(clicks >= 19);
});

test("any frame with a question holds the whole page", () => {
  const merged = mergeFrames([page({ next: "ready" }), page({ question: true, next: "none" })]);
  assert.equal(merged.question, true);
  assert.equal(merged.next, "ready");
});
