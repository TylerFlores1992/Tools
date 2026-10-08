import assert from "node:assert/strict";
import test from "node:test";
import { covers, mergeOsm, osmLayers, osmSource, parsePoly, parseOsm } from "../studio/campground-maps/osm.mjs";
import { compareLayers, layerIds } from "../studio/campground-maps/osm-compare.mjs";

// osmium's XML, as `osmium extract … -f osm` writes it (attributes from a real Colorado cut,
// 2026-10-08): version/timestamp/user come before lat/lon, unlike the API's order.
const OSMIUM = `<?xml version='1.0' encoding='UTF-8'?>
<osm version="0.6" generator="osmium/1.16.0">
  <node id="1" version="4" timestamp="2012-07-28T22:17:52Z" uid="374193" user="a" changeset="12529025" lat="39.3419804" lon="-105.3311557"/>
  <node id="2" version="3" timestamp="2012-07-28T22:17:52Z" uid="374193" user="a" changeset="12529025" lat="39.3413009" lon="-105.3280894"/>
  <node id="3" version="1" timestamp="2020-01-01T00:00:00Z" uid="1" user="b" changeset="1" lat="39.3415" lon="-105.329">
    <tag k="amenity" v="toilets"/>
  </node>
  <way id="10" version="10" timestamp="2025-12-10T01:37:07Z" uid="2" user="c" changeset="3">
    <nd ref="1"/>
    <nd ref="2"/>
    <tag k="highway" v="service"/>
  </way>
  <relation id="20" version="1" timestamp="2020-01-01T00:00:00Z" uid="1" user="b" changeset="1">
    <member type="way" ref="10" role="outer"/>
    <tag k="type" v="multipolygon"/>
    <tag k="natural" v="water"/>
  </relation>
</osm>`;

const ext = (region: string, box: number[], poly?: string) => ({ region, file: `/x/${region}.osm.pbf`, osmTimestamp: "2026-10-07T00:17:45Z", box, ...(poly ? { rings: parsePoly(poly) } : {}) });
// Two neighbours sharing the line lon = -102 (simplified from OSM France's us-west and us-south
// boundaries), with rectangles that overlap a lot, as their data boxes do.
const WEST_POLY = "us-west\n1\n -125 30\n -102 30\n -102 49\n -125 49\n -125 30\nEND\nEND\n";
const SOUTH_POLY = "us-south\n1\n -102 25\n -75 25\n -75 37\n -102 37\n -102 25\nEND\n!hole\n -90 30\n -89 30\n -89 31\n -90 31\n -90 30\nEND\nEND\n";
const WEST = ext("us-west", [-125, 30, -100, 49], WEST_POLY);
const SOUTH = ext("us-south", [-107, 24, -75, 40], SOUTH_POLY);

test("osmium's XML parses like the API's: nodes, a complete way, a relation, and the layers from them", () => {
  const doc = parseOsm(OSMIUM);
  assert.equal(doc.nodes.size, 3);
  assert.deepEqual(doc.nodes.get("1").at, [-105.3311557, 39.3419804]);
  assert.equal(doc.ways.get("10").complete, true);
  assert.deepEqual(doc.relations.map((r) => r.id), ["20"]);
  const L = osmLayers(doc);
  assert.equal(L.roads.length, 1);
  assert.deepEqual(L.pois.map((p) => p.type), ["Restroom"]);
  assert.deepEqual(L.waterRelations, ["20"]);
});

test("parsePoly reads outer rings and holes", () => {
  const p = parsePoly(SOUTH_POLY);
  assert.equal(p.outer.length, 1);
  assert.equal(p.holes.length, 1);
  assert.deepEqual(p.outer[0][1], [-75, 25]);
});

test("osmSource reads the extracts whose boundary the box is in, both at a border, the API only when none", () => {
  const colorado = [-105.4, 36.5, -105.3, 36.6], panhandle = [-102.05, 35, -101.95, 35.1], maine = [-68.3, 44.3, -68.2, 44.4];
  // Colorado is inside us-south's data rectangle but outside its boundary: one file, not two.
  assert.deepEqual(osmSource(colorado, "auto", [WEST, SOUTH]).regions, ["us-west"]);
  const both = osmSource(panhandle, "auto", [WEST, { ...SOUTH, osmTimestamp: "2026-10-06T00:00:00Z" }]);
  assert.deepEqual(both.regions, ["us-west", "us-south"]);
  assert.equal(both.asOf, "2026-10-06T00:00:00Z");
  assert.deepEqual(osmSource(maine, "auto", [WEST, SOUTH]), { from: "api" });
  assert.throws(() => osmSource(maine, "extract", [WEST, SOUTH]), /no OSM extract covers/);
  assert.deepEqual(osmSource(colorado, "api", [WEST, SOUTH]), { from: "api" });
});

test("covers: inside a hole isn't covered; a boundary corner inside the box is; no boundary falls back to the data box", () => {
  assert.equal(covers(SOUTH, [-89.6, 30.4, -89.5, 30.5]), false);
  assert.equal(covers(SOUTH, [-90.2, 30.4, -89.5, 30.5]), true);
  assert.equal(covers(WEST, [-125.1, 48.9, -124.9, 49.1]), true);
  // A strip narrower than the box crosses it: no corner is inside, the middle is.
  const strip = ext("strip", [-0.1, -10, 0.1, 10], "strip\n1\n -0.1 -10\n 0.1 -10\n 0.1 10\n -0.1 10\n -0.1 -10\nEND\nEND\n");
  assert.equal(covers(strip, [-1, -1, 1, 1]), true);
  // A small extract (an island) wholly inside the box, off its middle: only its corners are in.
  const island = ext("island", [1, 1, 2, 2], "island\n1\n 1 1\n 2 1\n 2 2\n 1 2\n 1 1\nEND\nEND\n");
  assert.equal(covers(island, [0, 0, 10, 10]), true);
  assert.equal(covers(island, [3, 3, 10, 10]), false);
  const noPoly = ext("x", [-110, 40, -109, 41]);
  assert.equal(covers(noPoly, [-109.5, 40.5, -109.4, 40.6]), true);
  assert.equal(covers(noPoly, [-108.5, 40.5, -108.4, 40.6]), false);
});

test("mergeOsm keeps a way complete if either copy is, and each relation once", () => {
  const a = parseOsm(OSMIUM);
  const b = parseOsm(OSMIUM.replace('<nd ref="2"/>', '<nd ref="2"/>\n    <nd ref="99"/>'));
  assert.equal(b.ways.get("10").complete, false);
  const m = mergeOsm([b, a]);
  assert.equal(m.ways.get("10").complete, true);
  assert.equal(m.relations.length, 1);
  assert.equal(mergeOsm([a, b]).ways.get("10").complete, true);
});

test("compareLayers counts what only one read has", () => {
  const a = layerIds(parseOsm(OSMIUM));
  const b = layerIds(parseOsm(OSMIUM.replace('<tag k="amenity" v="toilets"/>', '<tag k="amenity" v="drinking_water"/>')));
  const c = compareLayers(a, b);
  assert.deepEqual(c.pois, { api: 1, extract: 1, onlyApi: 1, onlyExtract: 1 });
  assert.deepEqual(c.roads, { api: 1, extract: 1, onlyApi: 0, onlyExtract: 0 });
});
