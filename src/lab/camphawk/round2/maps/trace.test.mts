import assert from "node:assert/strict";
import test from "node:test";
import { mapFor, type SiteMapData } from "./index.ts";
import { cleanRoad, draftOf, lengthM, sameDraft, segmentsOfPath, snap, toDeg, toXY, traceFile, withDraft, type TraceDraft } from "./trace.ts";
import { makeGeo } from "../../../../../studio/campground-maps/geo.mjs";
import { traceProblems } from "../../../../../studio/campground-maps/trace.mjs";

const upper = mapFor("upper-pines")!;
// A map with a bbox and a frame like every map built since 2026-10-07.
const framed = (): SiteMapData & { bbox: [number, number, number, number] } => {
  const pts: [number, number][] = [[-119.565, 37.735], [-119.561, 37.739], [-119.563, 37.737]];
  const geo = makeGeo(pts);
  return { ...upper, frame: geo.frame, bbox: geo.bboxArr.map((v: number) => Math.round(v * 1e6) / 1e6) as [number, number, number, number], roads: [], pois: [] };
};

test("a click's metres and degrees agree with the builder's own projection, to a few centimetres", () => {
  const map = framed();
  const geo = makeGeo([[-119.565, 37.735], [-119.561, 37.739], [-119.563, 37.737]]);
  for (const p of [[map.frame.x, map.frame.y], [map.frame.x + map.frame.w, map.frame.y + map.frame.h], [0, 0], [37.5, -80.2]] as [number, number][]) {
    const deg = toDeg(map, p);
    const [x, y] = geo.xy(deg);
    // The bbox is stored to 6 decimals (about 0.1 m), and geo.xy rounds to 0.1 m.
    assert.ok(Math.hypot(x - p[0], y - p[1]) < 0.25, `(${p}) → ${deg} → (${x}, ${y})`);
    const back = toXY(map, deg);
    assert.ok(Math.hypot(back[0] - p[0], back[1] - p[1]) < 0.02, "round trip");
  }
  // The frame's corners are the bbox's corners.
  assert.deepEqual(toDeg(map, [map.frame.x, map.frame.y]), [map.bbox[0], map.bbox[3]]);
  assert.deepEqual(toDeg(map, [map.frame.x + map.frame.w, map.frame.y + map.frame.h]), [map.bbox[2], map.bbox[1]]);
});

test("a path the builders write splits into its segments, rings closed", () => {
  assert.deepEqual(segmentsOfPath("M0 0L10 0L10 5M20 20L30 20"), [[[0, 0], [10, 0]], [[10, 0], [10, 5]], [[20, 20], [30, 20]]]);
  assert.deepEqual(segmentsOfPath("M0 0L4 0L4 3Z"), [[[0, 0], [4, 0]], [[4, 0], [4, 3]], [[4, 3], [0, 0]]]);
  assert.deepEqual(segmentsOfPath("M-1.5 2.5L3 4"), [[[-1.5, 2.5], [3, 4]]]);
  assert.ok(segmentsOfPath(upper.roads[0].d).length > 0);
});

test("a click near a road snaps onto it; a click farther off stays where it was", () => {
  const segs = segmentsOfPath("M0 0L100 0");
  assert.deepEqual(snap([40, 3], segs, 5), { at: [40, 0], snapped: true });
  assert.deepEqual(snap([40, 6], segs, 5), { at: [40, 6], snapped: false });
  assert.deepEqual(snap([-3, 0], segs, 5), { at: [0, 0], snapped: true }, "past the end: the end");
  // The nearest of two roads.
  assert.deepEqual(snap([50, 4], segmentsOfPath("M0 0L100 0M0 6L100 6"), 5).at, [50, 6]);
  assert.deepEqual(snap([1, 1], [], 5), { at: [1, 1], snapped: false });
});

test("a road's length", () => {
  assert.equal(lengthM([[0, 0], [3, 4], [3, 10]]), 11);
  assert.equal(lengthM([[0, 0]]), 0);
});

test("the camper's map with a draft: the draft replaces what was traced before, sources stay", () => {
  const map = framed();
  map.roads = [{ name: "Loop", cls: "Local", oneWay: "", d: "M0 0L10 0" }, { name: "", cls: "Service", oneWay: "", traced: true, d: "M5 5L9 9" }];
  map.pois = [{ name: "", type: "Restroom", at: [1, 1] }, { name: "", type: "Water", at: [2, 2], traced: true }];
  const a = toDeg(map, [0, 0]), b = toDeg(map, [20, 10]);
  const draft: TraceDraft = { roads: [{ coords: [a, b] }, { coords: [a] }], points: [{ type: "Restroom", at: b }] };
  const out = withDraft(map, draft);
  assert.deepEqual(out.roads.map((r) => [r.name, r.cls, !!r.traced]), [["Loop", "Local", false], ["", "Service", true]], "a one-point road is not drawn");
  assert.match(out.roads[1].d, /^M0 0L20 10$/);
  assert.deepEqual(out.pois.map((p) => [p.type, !!p.traced]), [["Restroom", false], ["Restroom", true]]);
  assert.ok(Math.hypot(out.pois[1].at[0] - 20, out.pois[1].at[1] - 10) < 0.02);
  const noBox = { ...map, bbox: undefined };
  assert.equal(withDraft(noBox, draft), noBox, "a map without a bbox can't take a draft");
});

test("the file the tool downloads is one the build accepts, and drops unfinished roads", () => {
  const map = framed();
  const a = toDeg(map, [0, 0]), b = toDeg(map, [20, 10]);
  const file = traceFile("ridb-232447", { roads: [{ coords: [a, b] }, { coords: [a] }], points: [{ type: "Water", at: b }] }, "Lab reviewer", "2026-10-07", "loop B");
  assert.deepEqual(file.roads, [{ coords: [a, b] }]);
  assert.equal(file.version, 1);
  assert.equal(file.note, "loop B");
  assert.deepEqual(traceProblems(file, "ridb-232447", map.bbox), []);
  // And a map built with that file hands the same draft back to the tool.
  assert.deepEqual(draftOf({ ...map, trace: file }), { roads: [{ coords: [a, b] }], points: [{ type: "Water", at: b }] });
  assert.deepEqual(draftOf(map), { roads: [], points: [] });
  assert.ok(sameDraft(draftOf({ ...map, trace: file }), { roads: [{ coords: [a, b] }], points: [{ type: "Water", at: b }] }));
  assert.ok(!sameDraft(draftOf(map), { roads: [{ coords: [a, b] }], points: [] }));
});

test("a draft that replaces the roads is the whole road layer; a through road is drawn wide", () => {
  const map = framed();
  map.roads = [{ name: "Loop", cls: "Service", oneWay: "", d: "M0 0L10 0" }];
  const a = toDeg(map, [0, 0]), b = toDeg(map, [20, 10]);
  const draft: TraceDraft = { roads: [{ coords: [a, b], through: true }], points: [], replace: true };
  const out = withDraft(map, draft);
  assert.deepEqual(out.roads.map((r) => [r.cls, !!r.traced]), [["Local", true]], "the source's loop is gone; the traced road is a through road");
  // A map built with a replacing trace keeps the source's roads aside: turning replace off brings them back.
  const built = { ...map, roads: [{ name: "", cls: "Local", oneWay: "", traced: true, d: "M0 0L20 10" }], sourceRoads: map.roads };
  assert.deepEqual(withDraft(built, { ...draft, replace: false }).roads.map((r) => r.name), ["Loop", ""]);
  // A replacing draft with no finished road doesn't wipe the map's roads.
  assert.deepEqual(withDraft(map, { roads: [{ coords: [a] }], points: [], replace: true }).roads.map((r) => r.name), ["Loop"]);
  // The file says both, and the build accepts it; a draft built from it hands both back.
  const file = traceFile("ridb-232447", draft, "Lab reviewer", "2026-10-07");
  assert.equal(file.replace, true);
  assert.deepEqual(file.roads, [{ coords: [a, b], through: true }]);
  assert.deepEqual(traceProblems(file, "ridb-232447", map.bbox), []);
  assert.deepEqual(draftOf({ ...map, trace: file }), draft);
  // Neither key is written when it's off.
  const plain = traceFile("ridb-232447", { roads: [{ coords: [a, b] }], points: [] }, "x", "2026-10-07");
  assert.ok(!("replace" in plain) && !("through" in plain.roads[0]));
});

test("a road's name is drawn and written; an empty name or a through road that's off is left out", () => {
  const map = framed();
  const a = toDeg(map, [0, 0]), b = toDeg(map, [20, 10]);
  const out = withDraft(map, { roads: [{ coords: [a, b], name: " WY 70 ", through: true }], points: [] });
  assert.equal(out.roads[0].name, "WY 70");
  const file = traceFile("ridb-232447", { roads: [{ coords: [a, b], name: " WY 70 " }, { coords: [a, b], name: "  " }], points: [] }, "x", "2026-10-07");
  assert.deepEqual(file.roads, [{ coords: [a, b], name: "WY 70" }, { coords: [a, b] }]);
  assert.deepEqual(traceProblems(file, "ridb-232447", map.bbox), []);
  assert.deepEqual(cleanRoad({ coords: [a, b], through: false, name: "" }), { coords: [a, b] });
  // So switching a setting off and on again is no change from the built trace.
  const built = draftOf({ ...map, trace: file });
  assert.ok(sameDraft(built, { roads: [cleanRoad({ coords: [a, b], name: "WY 70", through: false }), { coords: [a, b] }], points: [] }));
});
