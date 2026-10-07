import assert from "node:assert/strict";
import test from "node:test";
import { RULES, checkMap, inRing, sameNumber, toSegments } from "../studio/campground-maps/qa.mjs";

// A tidy loop campground in local metres: 20 sites in two rows either side of an east-west
// road, 12 m off it, 15 m apart. Every check passes on it; each test breaks one thing.
type At = [number, number] | null;
const road: [[number, number], [number, number]][] = [[[0, 0], [300, 0]]];
const good = () => Array.from({ length: 20 }, (_, i) => ({ name: String(i + 1).padStart(3, "0"), at: [10 + (i >> 1) * 15, i % 2 ? 12 : -12] as At }));
const run = (sites = good(), extra: Partial<Parameters<typeof checkMap>[0]> = {}) => checkMap({ sites, roadSegments: road, roadSource: "osm", ...extra });

test("a tidy campground is ready, with its measurements", () => {
  const r = run();
  assert.equal(r.verdict, "ready");
  assert.deepEqual(r.reasons, []);
  assert.equal(r.metrics.placed, 20);
  assert.equal(r.metrics.roads.medianM, 12);
  assert.equal(r.metrics.distinctPoints, 20);
});

test("a site with no point sends the map to review, and names it", () => {
  const s = good(); s[3].at = null;
  const r = run(s);
  assert.equal(r.verdict, "review");
  assert.deepEqual(r.metrics.unplaced, ["004"]);
  assert.match(r.reasons.map((x) => x.text).join(), /1 site has no point/);
  assert.deepEqual(r.reasons.map((x) => x.code), ["unplaced"]);
});

test("every site on one spot can't be drawn; a few shared spots need a look", () => {
  const one = good().map((s) => ({ ...s, at: [5, 5] as At }));
  assert.equal(run(one).verdict, "not-drawn");
  assert.match(run(one).reasons[0].text, /one spot/);
  // 40% stacked: past the not-drawn line.
  const many = good(); for (let i = 0; i < 8; i++) many[i].at = [50, 12];
  assert.equal(run(many).verdict, "not-drawn");
  // Two pairs stacked (4 of 20 = 20%): under the line, but a person looks.
  const few = good(); few[1].at = [...few[0].at!] as At; few[3].at = [...few[2].at!] as At;
  const r = run(few);
  assert.equal(r.verdict, "review");
  assert.equal(r.metrics.stackedShare, 0.2);
  assert.ok(r.metrics.stackedShare > RULES.stackedReview && r.metrics.stackedShare < RULES.stackedNotDrawn);
});

test("a site far from every other is an outlier, and a wide spread isn't one campground", () => {
  const s = good(); s[19].at = [10 + 9 * 15 + RULES.outlierM + 50, 12];
  const r = run(s);
  assert.equal(r.verdict, "review");
  assert.deepEqual(r.metrics.outliers, ["020"]);
  const wide = good().map((x, i) => ({ ...x, at: [i * 100, 12] as At }));
  assert.match(run(wide, { roadSegments: [[[0, 0], [2000, 0]]] }).reasons.map((x) => x.text).join(), /spread over 1\.9 km/);
});

test("no roads, or sites far from them, need a look", () => {
  assert.match(run(good(), { roadSegments: [], roadSource: "none" }).reasons.map((x) => x.text).join(), /No roads to draw/);
  const far = good().map((x) => ({ ...x, at: [x.at![0], x.at![1] * 4] as At })); // 48 m off the road
  const r = run(far);
  assert.equal(r.verdict, "review");
  assert.equal(r.metrics.roads.medianM, 48);
  // The 90th percentile alone also trips it: three sites in twenty set back 100 m.
  const tail = good(); for (const i of [0, 1, 2]) tail[i].at = [tail[i].at![0], 100];
  assert.equal(run(tail).metrics.roads.medianM, 12);
  assert.equal(run(tail).verdict, "review");
});

test("sites outside OpenStreetMap's campground outline, or far from its numbered pitches, need a look", () => {
  const box: [number, number][] = [[0, -30], [300, -30], [300, 30], [0, 30]];
  assert.equal(run(good(), { outlineRings: [box] }).verdict, "ready");
  const half: [number, number][] = [[0, -30], [80, -30], [80, 30], [0, 30]];
  const r = run(good(), { outlineRings: [half] });
  assert.equal(r.verdict, "review");
  assert.equal(r.metrics.outline!.insideShare, 0.5); // columns at x = 10, 25, 40, 55, 70
  // Pitches agree within a few metres: fine. Shifted 40 m: OSM disagrees with RIDB.
  const pitches = good().slice(0, 5).map((s) => ({ ref: String(Number(s.name)), at: [s.at![0] + 3, s.at![1]] as [number, number] }));
  assert.equal(run(good(), { pitches }).verdict, "ready");
  const shifted = pitches.map((p) => ({ ...p, at: [p.at[0] + 40, p.at[1]] as [number, number] }));
  assert.equal(run(good(), { pitches: shifted }).metrics.pitches!.medianM, 43);
  assert.equal(run(good(), { pitches: shifted }).verdict, "review");
  // Fewer than three matches is too few to judge by.
  assert.equal(run(good(), { pitches: shifted.slice(0, 2) }).verdict, "ready");
});

test("the geometry helpers", () => {
  assert.equal(toSegments([5, 3], [[[0, 0], [10, 0]]]), 3);
  assert.equal(toSegments([-4, 3], [[[0, 0], [10, 0]]]), 5);
  assert.ok(inRing([1, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]));
  assert.ok(!inRing([3, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]));
  assert.ok(sameNumber("007", "7") && sameNumber("A07", "a7") && !sameNumber("17", "7") && !sameNumber("A7", "B7"));
});

test("the checks list says each measurement, its limit and its result, and agrees with the verdict", () => {
  const ok = run();
  assert.equal(ok.checks.length, 7);
  assert.ok(ok.checks.every((c) => c.result === "pass" || c.result === "none"));
  assert.equal(ok.checks.find((c) => c.code === "outline")!.result, "none"); // nothing to check against
  for (const r of [run(good(), { roadSegments: [], roadSource: "none" }), run(good().map((x) => ({ ...x, at: [5, 5] as At })))]) {
    const worst = r.checks.some((c) => c.result === "fail") ? "not-drawn" : r.checks.some((c) => c.result === "review") ? "review" : "ready";
    assert.equal(worst, r.verdict);
  }
  assert.equal(run(good(), { roadSegments: [], roadSource: "none" }).checks.find((c) => c.code === "far-from-roads")!.value, "No roads to draw");
});
