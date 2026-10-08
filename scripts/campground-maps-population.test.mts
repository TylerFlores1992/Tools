import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { committedPicks, planWave, quotas } from "../studio/campground-maps/population.mjs";

const cg = (id: string, agency: string) => ({ id, agencyId: "", name: `C${id}`, agency, state: "CA", recArea: "", overnightSites: 10, placed: 10 });
// A population shaped like the real one (Forest Service most, then Army Corps, Park Service, BLM).
const POP = [
  ...Array.from({ length: 60 }, (_, i) => cg(`f${String(i).padStart(2, "0")}`, "Forest Service")),
  ...Array.from({ length: 25 }, (_, i) => cg(`a${String(i).padStart(2, "0")}`, "US Army Corps of Engineers")),
  ...Array.from({ length: 12 }, (_, i) => cg(`n${String(i).padStart(2, "0")}`, "National Park Service")),
  ...Array.from({ length: 3 }, (_, i) => cg(`b${i}`, "Bureau of Land Management")),
];

test("quotas split by largest remainder and never exceed a group's size", () => {
  const q = quotas(new Map([["a", 60], ["b", 25], ["c", 12], ["d", 3]]), 10);
  assert.deepEqual(Object.fromEntries(q), { a: 6, b: 3, c: 1, d: 0 });
  assert.deepEqual(Object.fromEntries(quotas(new Map([["a", 2], ["b", 1]]), 10)), { a: 2, b: 1 });
});

test("a wave puts every watched campground first, in order, then fills by agency, most-reserved first", () => {
  const reservations = new Map([["f05", 900], ["f01", 500], ["a03", 800], ["n07", 700], ["f00", 100]]);
  const w = planWave(POP, { watched: ["n02", "f10", "nope"], reservations, size: 10 });
  assert.equal(w.picked.length, 10);
  assert.deepEqual(w.picked.slice(0, 2).map((p) => [p.id, p.why]), [["n02", "watched"], ["f10", "watched"]]);
  // 8 left for 98 campgrounds: FS 60/98 → 5, Corps 25/98 → 2, NPS 11/98 → 1, BLM 0.
  assert.deepEqual(w.quota, { "Forest Service": 5, "US Army Corps of Engineers": 2, "National Park Service": 1, "Bureau of Land Management": 0 });
  const fs = w.picked.filter((p) => p.agency === "Forest Service" && p.why === "reservations").map((p) => p.id);
  assert.deepEqual(fs, ["f05", "f01", "f00", "f02", "f03"]);
  assert.equal(w.picked.find((p) => p.id === "a03")?.reservations, 800);
  assert.equal(w.remaining, 90);
});

test("a campground already in a wave is never picked again, watched or not", () => {
  const done = new Set(["n02", "f05"]);
  const w = planWave(POP, { done, watched: ["n02"], reservations: new Map([["f05", 999]]), size: 20 });
  assert.ok(!w.picked.some((p) => done.has(p.id)));
  assert.ok(!w.picked.some((p) => p.why === "watched"));
  assert.equal(new Set(w.picked.map((p) => p.id)).size, w.picked.length);
});

test("the watched list never reaches a committed wave spec: no counts, no reasons, not in the plan's order", () => {
  const spec = readFileSync(join(import.meta.dirname, "../studio/campground-maps/specs/wave-01.json"), "utf8");
  assert.doesNotMatch(spec, /"users"|"watches"|"why"|"reservations":/);
  const w = JSON.parse(spec);
  assert.equal(w.picked.length, 100);
  assert.deepEqual(w.picked, committedPicks(w.picked), "sorted by agency, then id");
});

test("committedPicks drops the reason and the reservation count and re-sorts", () => {
  const plan = [
    { id: "9", agency: "Forest Service", agencyId: "x", why: "watched", name: "A" },
    { id: "3", agency: "Army Corps", agencyId: "y", why: "reservations", reservations: 900, name: "B" },
    { id: "1", agency: "Forest Service", agencyId: "x", why: "reservations", reservations: 50, name: "C" },
  ];
  assert.deepEqual(committedPicks(plan), [{ id: "3", agency: "Army Corps", name: "B" }, { id: "1", agency: "Forest Service", name: "C" }, { id: "9", agency: "Forest Service", name: "A" }]);
});
