import { test } from "node:test";
import assert from "node:assert/strict";
import { geometryOf, readoutRows } from "./geometry.ts";
import type { Layer } from "./model.ts";

test("a read-out is kept as one small row per drawing layer, its shapes beside it", () => {
  const sq: [number, number][] = [[0, 0], [1, 0], [1, 1]];
  const shape = { pts: sq, z: 0, closed: true, label: "", h: 0, fill: false };
  const src = { name: "Set.rigread.json", dropboxId: "id:ro", from: "dropbox" as const };
  const made: Omit<Layer, "id">[] = [
    { name: "Set: Deck (1)", group: "Set: Deck", kind: "shapes", visible: true, at: "t", source: src, shapes: [shape, shape] },
    { name: "Set: Deck (2)", group: "Set: Deck", kind: "shapes", visible: true, at: "t", source: src, shapes: [shape] },
    { name: "Set: Venue", kind: "shapes", visible: false, at: "t", source: src, shapes: [shape] },
    { name: "Set: fixtures", kind: "fixtures", visible: true, at: "t", source: src, fixtures: [] },
  ];
  const rows = readoutRows(made, "id:ro");
  assert.deepEqual(rows.map((r) => [r.name, r.kind, r.visible]), [["Set: Deck", "shapes", true], ["Set: Venue", "shapes", false], ["Set: fixtures", "fixtures", true]]);
  assert.ok(rows.filter((r) => r.kind === "shapes").every((r) => !r.shapes && r.readout?.file === "id:ro"), "no shapes in the database rows");
  const g = geometryOf(made);
  assert.equal(g.get("Set: Deck")?.length, 3, "a layer split in parts comes back whole");
  assert.equal(g.get(rows[0].readout!.layer)?.length, 3, "each row finds its shapes by its own name");
});
