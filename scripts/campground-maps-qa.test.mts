import assert from "node:assert/strict";
import test from "node:test";
import { FIRST_COME_RULES, RULES, UNIT_RULES, checkAreas, checkDispersed, checkFirstCome, checkMap, checkUnit, inRing, sameNumber, toSegments } from "../studio/campground-maps/qa.mjs";

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
  // A literal distance, not RULES.outlierM + 50: a test that moves with the constant can't catch a bad constant.
  const s = good(); s[19].at = [10 + 9 * 15 + 350, 12];
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
  const tail = good(); for (const i of [0, 2, 4]) tail[i].at = [tail[i].at![0], 100]; // three distinct sites, none stacked
  assert.equal(run(tail).metrics.roads.medianM, 12);
  assert.equal(run(tail).verdict, "review");
  assert.equal(run(tail).metrics.stackedShare, 0);
  assert.deepEqual(run(tail).reasons.map((x) => x.code), ["far-from-roads"]);
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
  assert.equal(ok.checks.length, 8);
  assert.ok(ok.checks.every((c) => c.result === "pass" || c.result === "none"));
  assert.equal(ok.checks.find((c) => c.code === "outline")!.result, "none"); // nothing to check against
  for (const r of [run(good(), { roadSegments: [], roadSource: "none" }), run(good().map((x) => ({ ...x, at: [5, 5] as At })))]) {
    const worst = r.checks.some((c) => c.result === "fail") ? "not-drawn" : r.checks.some((c) => c.result === "review") ? "review" : "ready";
    assert.equal(worst, r.verdict);
  }
  assert.equal(run(good(), { roadSegments: [], roadSource: "none" }).checks.find((c) => c.code === "far-from-roads")!.value, "No roads to draw");
});

test("two points a metre apart are one spot; three metres apart are two", () => {
  const near = good(); near[1].at = [near[0].at![0] + 1, near[0].at![1]];
  assert.equal(run(near).metrics.stackedShare, 0.1);
  const apart = good(); apart[1].at = [apart[0].at![0] + 3, apart[0].at![1]];
  assert.equal(run(apart).metrics.stackedShare, 0);
});

test("a map that can't be drawn says so, even when it also has things to look at", () => {
  const r = run(good().map((x) => ({ ...x, at: [5, 5] as At })), { roadSegments: [], roadSource: "none" });
  assert.equal(r.verdict, "not-drawn");
  assert.deepEqual(r.reasons.map((x) => x.code), ["one-spot"]);
});

test("a two-site campground with its sites far apart has no outlier (there's no crowd to stray from)", () => {
  const r = run([{ name: "1", at: [0, 10] }, { name: "2", at: [400, 10] }], { roadSegments: [[[0, 0], [400, 0]]] });
  assert.deepEqual(r.metrics.outliers, []);
  assert.equal(r.verdict, "ready");
});

test("the checks list marks the road check for review when sites sit far from the roads", () => {
  const far = good().map((x) => ({ ...x, at: [x.at![0], x.at![1] * 4] as At }));
  assert.equal(run(far).checks.find((c) => c.code === "far-from-roads")!.result, "review");
  assert.equal(run().checks.find((c) => c.code === "far-from-roads")!.result, "pass");
});

test("anything traced from the aerial photo waits for a person, however well the sites fit", () => {
  const r = run(good(), { traced: { roads: 2, points: 1 } });
  assert.equal(r.verdict, "review");
  assert.deepEqual(r.reasons.map((x) => x.code), ["traced"]);
  assert.equal(r.reasons[0].text, "2 roads and 1 point traced from the aerial photo");
  const row = r.checks.find((c) => c.code === "traced")!;
  assert.equal(row.result, "review");
  assert.equal(row.value, "2 roads and 1 point");
  assert.equal(run(good(), { traced: { roads: 1, points: 0 } }).reasons[0].text, "1 road traced from the aerial photo");
  // Nothing traced: no reason, and the row has nothing to check.
  assert.equal(run().verdict, "ready");
  assert.equal(run().checks.find((c) => c.code === "traced")!.result, "none");
  // Traced roads alone are roads: no "No roads to draw".
  const only = run(good(), { roadSource: "traced", traced: { roads: 1, points: 0 } });
  assert.deepEqual(only.reasons.map((x) => x.code), ["traced"]);
});

// --- Split listings: two tidy loops 3 km apart, each along its own road. ---
const twoAreas = () => {
  const west = good();
  const east = good().map((s, i) => ({ name: String(101 + i), at: [3000 + s.at![0], s.at![1]] as At }));
  return { sites: [...west, ...east], roads: [...road, [[3000, 0], [3300, 0]]] as [[number, number], [number, number]][] };
};
const areasOf = (sites: { name: string; at: At }[]) => [
  { name: "Sites 001–020", sites: sites.slice(0, 20).map((s) => s.name), frame: { x: -40, y: -80, w: 240, h: 160 } },
  { name: "Sites 101–120", sites: sites.slice(20).map((s) => s.name), frame: { x: 2960, y: -80, w: 240, h: 160 } },
];

test("a split listing is checked area by area: the spread goes, and a person checks the split", () => {
  const { sites, roads } = twoAreas();
  const input = { sites, roadSegments: roads, roadSource: "osm" };
  const whole = checkMap(input);
  assert.ok(whole.reasons.some((r) => r.code === "spread"));
  const r = checkAreas(whole, areasOf(sites), input);
  assert.equal(r.verdict, "review");
  assert.deepEqual(r.reasons.map((x) => x.code), ["areas"]);
  assert.match(r.reasons[0].text, /2 areas/);
  assert.deepEqual(r.areas!.map((a) => a.verdict), ["ready", "ready"]);
  assert.equal(r.metrics.areas, 2);
  assert.equal(r.checks.find((c) => c.code === "spread")!.result, "review");
  assert.match(r.checks.find((c) => c.code === "spread")!.value, /2 areas/);
});

test("an area's own problem is named with the area; the listing's are kept once", () => {
  const { sites, roads } = twoAreas();
  // The east area's road is gone (sites 3 km from the west road), and one west site has no point.
  sites[3] = { ...sites[3], at: null };
  const input = { sites, roadSegments: [roads[0]], roadSource: "osm" };
  const r = checkAreas(checkMap(input), areasOf(sites), input);
  assert.deepEqual(r.reasons.map((x) => x.code), ["areas", "unplaced", "far-from-roads"]);
  assert.match(r.reasons[2].text, /^Sites 101–120: Sites sit far from the roads/);
  assert.deepEqual(r.areas!.map((a) => a.verdict), ["ready", "review"]);
});

test("an area is judged only by the OpenStreetMap outlines that reach it", () => {
  const { sites, roads } = twoAreas();
  const westRing: [number, number][] = [[-30, -30], [200, -30], [200, 30], [-30, 30]];
  // A third outline 2 km beyond the east area reaches neither area.
  const beyond: [number, number][] = [[5000, -30], [5200, -30], [5200, 30], [5000, 30]];
  const input = { sites, roadSegments: roads, roadSource: "osm", outlineRings: [westRing, beyond] };
  // As one listing, half the sites are outside the only outline.
  assert.ok(checkMap(input).reasons.some((r) => r.code === "outline"));
  const r = checkAreas(checkMap(input), areasOf(sites), input);
  assert.ok(!r.reasons.some((x) => x.code === "outline"), JSON.stringify(r.reasons));
});

test("a listing that can't be drawn stays not drawn, split or not", () => {
  const sites = good().map((s) => ({ ...s, at: [5, 5] as At }));
  const input = { sites, roadSegments: road, roadSource: "osm" };
  const whole = checkMap(input);
  assert.equal(checkAreas(whole, areasOf(sites), input).verdict, "not-drawn");
  assert.equal(checkDispersed(whole, 30).verdict, "not-drawn");
});

test("a dispersed listing is held and says why, instead of the spread", () => {
  const { sites, roads } = twoAreas();
  const whole = checkMap({ sites, roadSegments: roads, roadSource: "osm" });
  const r = checkDispersed(whole, 30);
  assert.equal(r.verdict, "review");
  assert.equal(r.reasons[0].code, "dispersed");
  assert.match(r.reasons[0].text, /^30 groups/);
  assert.ok(!r.reasons.some((x) => x.code === "spread"));
});

// --- Single units ---
const unit = (over: Partial<Parameters<typeof checkUnit>[0]> = {}) => checkUnit({ site: { name: "LOOKOUT", at: [0, 0] }, facilityAt: [40, 30], roadSegments: [[[-700, 200], [700, 200]]], trailSegments: [], roadSource: "usfs", ...over });

test("a single unit near its listing's point with a road on the map is ready, with its distances", () => {
  const r = unit();
  assert.equal(r.verdict, "ready");
  assert.deepEqual(r.reasons, []);
  assert.equal(r.metrics.kind, "unit");
  assert.equal(r.metrics.facilityM, 50);
  assert.equal(r.metrics.roadM, 200);
  assert.equal(r.metrics.trailM, null);
  assert.ok(r.checks.every((c) => c.result === "pass" || c.result === "none"));
});

test("a unit far from its listing's own point needs a look; the limit is the rule's", () => {
  assert.equal(unit({ facilityAt: [UNIT_RULES.facilityAgreeM, 0] }).verdict, "ready");
  const r = unit({ facilityAt: [UNIT_RULES.facilityAgreeM + 1, 0] });
  assert.deepEqual(r.reasons.map((x) => x.code), ["facility-point"]);
  assert.equal(r.checks.find((c) => c.code === "facility-point")!.result, "review");
  assert.match(unit({ facilityAt: [2400, 0] }).reasons[0].text, /2\.4 km/);
  // No listing point: nothing to compare, not a fault.
  assert.equal(unit({ facilityAt: null }).verdict, "ready");
});

test("a unit reached only by trail is fine; one with no road or trail on the map needs a look", () => {
  const far: [[number, number], [number, number]][] = [[[-700, UNIT_RULES.accessM + 1], [700, UNIT_RULES.accessM + 1]]];
  const near: [[number, number], [number, number]][] = [[[-700, UNIT_RULES.accessM], [700, UNIT_RULES.accessM]]];
  assert.equal(unit({ roadSegments: near }).verdict, "ready");
  assert.equal(unit({ roadSegments: far, trailSegments: [[[0, -50], [0, -400]]] }).verdict, "ready");
  const r = unit({ roadSegments: far, trailSegments: far });
  assert.deepEqual(r.reasons.map((x) => x.code), ["no-access"]);
  assert.equal(r.checks.find((c) => c.code === "no-access")!.result, "review");
  assert.deepEqual(unit({ roadSegments: [], trailSegments: [] }).reasons.map((x) => x.code), ["no-access"]);
});

test("a unit with no point can't be drawn; one with traced roads waits for a person", () => {
  assert.equal(unit({ site: { name: "CABIN", at: null } }).verdict, "not-drawn");
  const r = unit({ traced: { roads: 1, points: 0 } });
  assert.deepEqual(r.reasons.map((x) => x.code), ["traced"]);
});

test("a first-come campground is ready when an outline holds its point (or lies within reach) and it isn't closed", () => {
  const sq = (x: number, y: number, w: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + w], [x, y + w]];
  const fc = (over: Partial<Parameters<typeof checkFirstCome>[0]> = {}) => checkFirstCome({ site: { name: "Standard", at: [0, 0] }, outlineRings: [sq(-50, -50, 100)], ...over });
  const inside = fc();
  assert.equal(inside.verdict, "ready");
  assert.equal(inside.metrics.outlineM, 0);
  assert.equal(inside.metrics.kind, "firstcome");
  // On the road 40 m south of the outline: still the campground's outline.
  const near = fc({ outlineRings: [sq(-50, 40, 100)] });
  assert.equal(near.verdict, "ready");
  assert.equal(near.metrics.outlineM, 40);
  // Beyond reach, or no outline: a person looks.
  const far = fc({ outlineRings: [sq(FIRST_COME_RULES.outlineReachM + 10, 0, 50)] });
  assert.equal(far.verdict, "review");
  assert.deepEqual(far.reasons.map((r) => r.code), ["no-outline"]);
  assert.match(far.reasons[0].text, /m from the listed point/);
  assert.equal(fc({ outlineRings: [] }).verdict, "review");
  assert.match(fc({ outlineRings: [] }).reasons[0].text, /doesn’t outline/);
  // Closed: a person looks, and the check says so.
  const closed = fc({ closed: true });
  assert.deepEqual(closed.reasons.map((r) => r.code), ["closed"]);
  assert.equal(closed.checks.find((c) => c.code === "closed")!.result, "review");
  // No point: not drawn.
  assert.equal(fc({ site: { name: "Standard", at: null } }).verdict, "not-drawn");
  // A trace waits for a person too.
  assert.deepEqual(fc({ traced: { roads: 1, points: 0 } }).reasons.map((r) => r.code), ["traced"]);
});
