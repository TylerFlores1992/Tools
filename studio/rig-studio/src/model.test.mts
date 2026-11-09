// Rig Studio's page helpers: lengths as Vectorworks writes them, fixtures from the connector and CSV.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixturesFromCsv, fixturesFromVectorworks, ftIn, parseLength } from "./model.ts";

test("lengths: feet and inches, metric, bare numbers in document units", () => {
  assert.equal(parseLength(`20'-6"`), 246);
  assert.equal(parseLength(`20'`), 240);
  assert.equal(parseLength(`6 1/2"`), null);
  assert.equal(parseLength(`12'-6 1/2"`), 150.5);
  assert.equal(parseLength("2540mm"), 100);
  assert.equal(parseLength(254, 25.4), 10);
  assert.equal(parseLength("nope"), null);
  assert.equal(ftIn(268), `22'-4"`);
  assert.equal(ftIn(8.5), `8½"`);
});

test("fixtures from get_lighting_devices: insertion point, Z, weight in lb or kg, type", () => {
  const f = fixturesFromVectorworks({
    units: { units_per_inch: 1 },
    devices: [
      { id: "a", location: [120, 48], z: 470, fields: { "Inst Type": "Spot 400", Weight: "55 lb" }, bbox: [[0, 0], [1, 1]] },
      { id: "b", location: [254, 0], z: 0, fields: { "Inst Type": "Wash", Weight: "10 kg", "Z Location": "20'" } },
      { id: "c", bbox: [[10, 10], [20, 30]], fields: {} },
    ],
  });
  assert.deepEqual(f[0], { x: 120, y: 48, z: 470, lb: 55, type: "Spot 400", id: "a" });
  assert.equal(f[1].lb, 22);
  assert.deepEqual([f[2].x, f[2].y], [15, 20]);
  const mm = fixturesFromVectorworks({ units: { units_per_inch: 25.4 }, devices: [{ location: [2540, 0], z: 5080, fields: {} }] });
  assert.deepEqual([mm[0].x, mm[0].z], [100, 200]);
});

test("fixtures from a CSV in feet, or inches when the header says so", () => {
  const ft = fixturesFromCsv("Type,X,Y,Z,Weight\nSpot,10,4,20,55\nWash,12,4,20,30\n");
  assert.deepEqual(ft.fixtures[0], { x: 120, y: 48, z: 240, lb: 55, type: "Spot" });
  const inch = fixturesFromCsv('x (in),y (in),z (in)\n120,48,240\n');
  assert.equal(inch.fixtures[0].x, 120);
  assert.match(fixturesFromCsv("a,b\n1,2").problem ?? "", /x and y/);
});

import { sortProjects } from "./model.ts";

test("the project list: pinned first in the order pinned, then most recently changed", () => {
  const p = (id: string, updatedAt: string, pinnedAt?: string | null) => ({ id, updatedAt, pinnedAt });
  const out = sortProjects([p("old", "2026-01-01"), p("new", "2026-03-01"), p("pin2", "2026-01-02", "2026-02-02"), p("pin1", "2025-01-01", "2026-02-01"), p("unpinned", "2026-02-01", null)]);
  assert.deepEqual(out.map((x) => x.id), ["pin1", "pin2", "new", "unpinned", "old"]);
});
