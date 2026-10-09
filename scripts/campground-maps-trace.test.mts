import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POINT_TYPES, TRACE_VERSION, applySiteMoves, creditWith, readTrace, traceProblems } from "../studio/campground-maps/trace.mjs";

const bbox: [number, number, number, number] = [-122.39, 44.58, -122.37, 44.59];
const ok = () => ({
  version: 1, map: "ridb-274721", traced: "2026-10-07", by: "test", photo: "USDA NAIP",
  roads: [{ coords: [[-122.385, 44.585], [-122.38, 44.586]] }],
  points: [{ type: "Restroom", at: [-122.381, 44.584] }],
  note: "",
});

test("a good trace file has no problems", () => {
  assert.deepEqual(traceProblems(ok(), "ridb-274721", bbox), []);
  assert.equal(TRACE_VERSION, 1);
  assert.deepEqual(POINT_TYPES, ["Restroom", "Water"]);
});

test("a trace for another map, version or shape is refused, in words", () => {
  assert.deepEqual(traceProblems({ ...ok(), map: "ridb-1" }, "ridb-274721", bbox), ['it is for "ridb-1", not ridb-274721']);
  assert.deepEqual(traceProblems({ ...ok(), version: 2 }, "ridb-274721", bbox), ["version must be 1"]);
  assert.deepEqual(traceProblems({ ...ok(), roads: {} }, "ridb-274721", bbox), ["roads must be a list"]);
  assert.deepEqual(traceProblems(null, "ridb-274721", bbox), ["not a trace file"]);
});

test("a road needs two real points inside the map (or a little past its edge)", () => {
  const t = ok();
  t.roads = [{ coords: [[-122.385, 44.585]] }, { coords: [[-122.385, 44.585], ["x", 44] as unknown as number[]] }, { coords: [[-122.385, 44.585], [-121, 44.585]] }];
  assert.deepEqual(traceProblems(t, "ridb-274721", bbox), ["road 1 needs at least two points", "road 2 has a point that isn't [lon, lat]", "road 3 runs far outside the map"]);
  // A quarter of the frame past the edge is allowed (a lane meeting the road it joins).
  t.roads = [{ coords: [[-122.385, 44.585], [-122.3651, 44.585]] }];
  assert.deepEqual(traceProblems(t, "ridb-274721", bbox), []);
  t.roads = [{ coords: [[-122.385, 44.585], [-122.3649, 44.585]] }];
  assert.deepEqual(traceProblems(t, "ridb-274721", bbox), ["road 1 runs far outside the map"]);
  // North and south too.
  t.roads = [{ coords: [[-122.385, 44.585], [-122.385, 44.5926]] }];
  assert.deepEqual(traceProblems(t, "ridb-274721", bbox), ["road 1 runs far outside the map"]);
  t.roads = [{ coords: [[-122.385, 44.585], [-122.385, 44.5774]] }];
  assert.deepEqual(traceProblems(t, "ridb-274721", bbox), ["road 1 runs far outside the map"]);
});

test("a point must be a restroom or a water tap, inside the map", () => {
  const t = ok();
  t.points = [{ type: "Shed", at: [-122.38, 44.585] }, { type: "Water", at: [0, 0] }, { type: "Water", at: [1] as unknown as number[] }];
  assert.deepEqual(traceProblems(t, "ridb-274721", bbox), ["point 1 must be one of Restroom, Water", "point 2 is far outside the map", "point 3 isn't at [lon, lat]"]);
});

test("readTrace: none when nobody traced it; a broken file stops the build", () => {
  const dir = mkdtempSync(join(tmpdir(), "traces-"));
  assert.equal(readTrace("ridb-274721", bbox, dir), null);
  writeFileSync(join(dir, "ridb-274721.json"), JSON.stringify(ok()));
  assert.equal(readTrace("ridb-274721", bbox, dir).roads.length, 1);
  writeFileSync(join(dir, "ridb-274721.json"), JSON.stringify({ ...ok(), map: "ridb-9" }));
  assert.throws(() => readTrace("ridb-274721", bbox, dir), /it is for "ridb-9"/);
});

test("replace and through must be true or false; a replacing trace needs a road", () => {
  assert.deepEqual(traceProblems({ ...ok(), replace: true, roads: [{ coords: [[-122.385, 44.585], [-122.38, 44.586]], through: true }] }, "ridb-274721", bbox), []);
  assert.deepEqual(traceProblems({ ...ok(), replace: "yes" }, "ridb-274721", bbox), ["replace must be true or false"]);
  assert.deepEqual(traceProblems({ ...ok(), roads: [{ coords: [[-122.385, 44.585], [-122.38, 44.586]], through: 1 }] }, "ridb-274721", bbox), ["road 1: through must be true or false"]);
  assert.deepEqual(traceProblems({ ...ok(), replace: true, roads: [] }, "ridb-274721", bbox), ["a trace that replaces the roads needs at least one road"]);
});

test("a road's name is optional text, up to 80 characters", () => {
  const road = (name: unknown) => ({ ...ok(), roads: [{ coords: [[-122.385, 44.585], [-122.38, 44.586]], name }] });
  assert.deepEqual(traceProblems(road("WY 70"), "ridb-274721", bbox), []);
  assert.deepEqual(traceProblems(road(7), "ridb-274721", bbox), ["road 1: name must be text, up to 80 characters"]);
  assert.deepEqual(traceProblems(road("x".repeat(81)), "ridb-274721", bbox), ["road 1: name must be text, up to 80 characters"]);
});

test("a trace may move sites: each by the listing's name, once, to a point near the map", () => {
  assert.deepEqual(traceProblems({ ...ok(), sites: [{ name: "A09", at: [-122.38, 44.585] }] }, "ridb-274721", bbox), []);
  assert.deepEqual(traceProblems({ ...ok(), sites: "A09" }, "ridb-274721", bbox), ["sites must be a list"]);
  assert.match(traceProblems({ ...ok(), sites: [{ name: " ", at: [-122.38, 44.585] }] }, "ridb-274721", bbox).join(), /needs the listing's name/);
  assert.match(traceProblems({ ...ok(), sites: [{ name: "A09", at: [-122.38, 44.585] }, { name: "A09", at: [-122.381, 44.585] }] }, "ridb-274721", bbox).join(), /moved twice/);
  assert.match(traceProblems({ ...ok(), sites: [{ name: "A09", at: [-120, 44.585] }] }, "ridb-274721", bbox).join(), /far outside the map/);
  assert.match(traceProblems({ ...ok(), sites: [{ name: "A09", at: [1] }] }, "ridb-274721", bbox).join(), /isn't at \[lon, lat\]/);
  // Read before the map is framed (no bbox), a stray site's move isn't judged by place yet.
  assert.deepEqual(traceProblems({ ...ok(), sites: [{ name: "A09", at: [-120, 44.585] }] }, "ridb-274721", null), []);
});

test("the build moves a traced site and keeps where the listing had it; an unknown name stops the build", () => {
  const sites = [{ name: "A09", lat: 44.5, lon: -122.3 }, { name: "A10", lat: 44.6, lon: -122.4 }, { name: "A11", lat: 0, lon: 0 }];
  const moved = applySiteMoves(sites, [{ name: "A09", at: [-122.31, 44.51] }, { name: "A11", at: [-122.32, 44.52] }]);
  assert.deepEqual(moved[0], { name: "A09", lat: 44.51, lon: -122.31, movedFrom: [-122.3, 44.5] });
  assert.deepEqual(moved[1], sites[1]);
  assert.deepEqual(moved[2], { name: "A11", lat: 44.52, lon: -122.32, movedFrom: null }, "a site the listing had no point for gets one, from nothing");
  assert.deepEqual(applySiteMoves(sites), sites);
  assert.throws(() => applySiteMoves(sites, [{ name: "B01", at: [-122.31, 44.51] }]), /B01/);
  // A name two sites share can't say which one moves.
  assert.throws(() => applySiteMoves([...sites, { name: "A09", lat: 44.7, lon: -122.5 }], [{ name: "A09", at: [-122.31, 44.51] }]), /2 sites by that name/);
});

test("a trace file is read before the map is framed too (no bbox), and checked fully after", () => {
  const dir = mkdtempSync(join(tmpdir(), "trace-"));
  writeFileSync(join(dir, "ridb-274721.json"), JSON.stringify({ ...ok(), sites: [{ name: "A09", at: [-120, 44.585] }] }));
  assert.equal(readTrace("ridb-274721", null, dir).sites[0].name, "A09");
  assert.throws(() => readTrace("ridb-274721", bbox, dir), /far outside the map/);
});

test("a trace rewritten by another tracer, or again by the same one, keeps every earlier credit", () => {
  assert.equal(creditWith(undefined, "B"), "B");
  assert.equal(creditWith("A", "B"), "A; B");
  // The bug: B rewriting a trace it had already added to used to leave only "B".
  assert.equal(creditWith("A; B", "B"), "A; B");
  assert.equal(creditWith("B", "B"), "B");
});
