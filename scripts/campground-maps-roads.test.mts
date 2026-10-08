import assert from "node:assert/strict";
import test from "node:test";
import { MARGIN, ROAD_ORDER, pickRoadSource, roadFit } from "../studio/campground-maps/roads.mjs";

// Fits as measured on the 2026-10-07 sample (median / p90, metres), so the rule is tested on the
// cases it was built for.
const fit = (medianM: number, p90M: number) => ({ medianM, p90M });

test("Twin Peaks: the Park Service has only the outer loop, so OpenStreetMap's inner rows win", () => {
  const r = pickRoadSource({ nps: fit(66, 118), osm: fit(11, 13), usfs: null, tiger: fit(274, 390) });
  assert.equal(r.source, "osm");
  assert.equal(r.why, "Its roads fit the sites better: 9 in 10 within 13 m, against 118 m");
});

test("the usual source keeps the map when its fit is close to the best (Edna Creek, Hearts Content)", () => {
  // TIGER's 6 m beats the Forest Service's 8 m, but within the 5 m margin: the earlier source stays.
  assert.equal(pickRoadSource({ nps: null, osm: fit(84, 103), usfs: fit(5, 8), tiger: fit(5, 6) }).source, "usfs");
  // A quarter of a big p90 is the margin when that's more than 5 m: 27 + 6.75 covers 30.
  const r = pickRoadSource({ nps: null, osm: fit(18, 30), usfs: fit(14, 27), tiger: fit(113, 215) });
  assert.equal(r.source, "osm");
  assert.equal(r.why, "The usual source, and its roads fit the sites as well as any");
});

test("a source is passed over only when another is clearly better (Cave Creek, Udall Park)", () => {
  assert.equal(pickRoadSource({ nps: null, osm: fit(237, 360), usfs: null, tiger: fit(15, 29) }).source, "tiger");
  // 39 m against 25 m: 14 m past a 6.25 m margin.
  assert.equal(pickRoadSource({ nps: null, osm: fit(22, 39), usfs: null, tiger: fit(20, 25) }).source, "tiger");
  // Just inside and just outside the margin.
  assert.equal(pickRoadSource({ nps: null, osm: fit(10, 25), usfs: null, tiger: fit(10, 20) }).source, "osm");
  assert.equal(pickRoadSource({ nps: null, osm: fit(10, 25.1), usfs: null, tiger: fit(10, 20) }).source, "tiger");
});

test("ties on p90 go to the better median, then to the usual order", () => {
  assert.equal(pickRoadSource({ nps: null, osm: fit(30, 60), usfs: fit(10, 60), tiger: null }).source, "osm", "osm is within the margin of the best");
  assert.equal(pickRoadSource({ nps: null, osm: fit(30, 200), usfs: fit(20, 60), tiger: fit(10, 60) }).source, "usfs");
});

test("one source, or none", () => {
  assert.deepEqual(pickRoadSource({ nps: null, osm: fit(10, 20), usfs: null, tiger: null }), { source: "osm", why: "The only source with roads here" });
  assert.deepEqual(pickRoadSource({ nps: null, osm: null, usfs: null, tiger: null }), { source: "none", why: "No source has roads here" });
  assert.deepEqual(pickRoadSource({}), { source: "none", why: "No source has roads here" });
});

test("the order and margin are what the header says", () => {
  assert.deepEqual(ROAD_ORDER, ["nps", "osm", "usfs", "tiger"]);
  assert.deepEqual(MARGIN, { minM: 5, share: 0.25 });
});

test("roadFit measures each site to its nearest road: median and 9 in 10", () => {
  const road: [[number, number], [number, number]][] = [[[0, 0], [100, 0]]];
  const pts: [number, number][] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 50].map((d, i) => [i * 10, d]);
  assert.deepEqual(roadFit(pts, road), { medianM: 5.5, p90M: 9 });
  assert.deepEqual(roadFit([[0, 4], [10, 6], [20, 8]], road), { medianM: 6, p90M: 8 });
  assert.equal(roadFit(pts, []), null);
  assert.equal(roadFit([], road), null);
});
