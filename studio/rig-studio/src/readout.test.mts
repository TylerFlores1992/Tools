// A Vectorworks read-out becomes fixtures, the existing rig and outlines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadout, readoutLayers, readoutSummary, type Readout } from "./readout.ts";

export const SAMPLE: Readout = {
  readout: 1,
  document: "CFF-26.vwx",
  units: "in",
  layers: [
    { name: "Stage", type: "design", elevation: 0 },
    { name: "Lighting", type: "design", elevation: 0 },
    { name: "Sheet 1", type: "sheet" },
  ],
  classes: ["None"],
  objects: [
    { t: "plugin_object", layer: "Lighting", cls: "Lighting-Spot", bbox: [0, 0, 1, 1], at: [120, 240, 300], rot: 0, plugin: "Lighting Device", fields: { "Inst Type": "Mac Viper", Weight: "86 lb", Channel: "101" } },
    { t: "plugin_object", layer: "Lighting", cls: "Lighting-Wash", bbox: [0, 0, 1, 1], at: [240, 240, 300], rot: 0, plugin: "Lighting Device", fields: { "Inst Type": "Wash", Weight: "20 kg" } },
    { t: "plugin_object", layer: "Rigging", cls: "Truss", bbox: [0, 230, 480, 250], at: [0, 240, 310], rot: 0, plugin: "Truss", fields: { "Truss Type": "12in Box", Length: "40'" } },
    { t: "plugin_object", layer: "Rigging", cls: "Truss", bbox: [0, 0, 20, 480], at: [0, 0, 310], rot: 90, plugin: "Truss", fields: {} },
    { t: "plugin_object", layer: "Rigging", cls: "Rigging", bbox: [0, 0, 1, 1], at: [0, 240, 330], rot: 0, plugin: "Hoist", fields: { Capacity: "1 Ton" } },
    { t: "rectangle", layer: "Stage", cls: "None", bbox: [0, 0, 480, 360], pts: [[0, 0], [480, 0], [480, 360], [0, 360]], closed: true, name: "Deck" },
    { t: "line", layer: "Lighting", cls: "None", bbox: [0, 0, 10, 0], pts: [[0, 0], [10, 0]] },
  ],
};

test("a read-out turns into fixtures, the existing rig and one outline layer per drawing layer", () => {
  assert.ok(isReadout(SAMPLE) && !isReadout({ readout: 2 }));
  const layers = readoutLayers(SAMPLE, { name: "CFF-26.rigread.json", from: "dropbox" }, "2026-11-09T00:00:00Z");
  const fx = layers.find((l) => l.kind === "fixtures")!;
  assert.equal(fx.fixtures!.length, 2);
  assert.deepEqual(fx.fixtures![0], { x: 120, y: 240, z: 300, lb: 86, type: "Mac Viper", id: "ch 101" });
  assert.equal(fx.fixtures![1].lb, 44.1);
  const rig = layers.find((l) => l.kind === "rig")!;
  const [t1, t2, h] = rig.rig!;
  assert.deepEqual([t1.kind, t1.b], ["truss", [480, 240, 310]]);
  assert.ok(t2.kind === "truss" && !t2.b && t2.bbox, "a truss with no length keeps its outline");
  assert.equal(h.kind, "hoist");
  const stage = layers.find((l) => l.name === "CFF-26: Stage")!;
  assert.ok(stage.visible && stage.shapes![0].closed && stage.shapes![0].label === "Deck");
  assert.equal(layers.find((l) => l.name === "CFF-26: Lighting")!.visible, false, "only stage-like outline layers start shown");
  assert.match(readoutSummary(SAMPLE), /2 lighting fixtures, 2 truss pieces, 2 outlines on 2 design layers/);
});

test("big outline layers are split so no layer document is too big to store", () => {
  const many = { ...SAMPLE, objects: Array.from({ length: 3000 }, (_, i) => ({ t: "polygon", layer: "Venue", cls: "None", bbox: [0, 0, 1, 1] as [number, number, number, number], pts: Array.from({ length: 6 }, (_, k) => [i, k] as [number, number]) })) };
  const layers = readoutLayers(many, undefined, "t");
  assert.ok(layers.length >= 2);
  for (const l of layers) assert.ok(JSON.stringify(l).length < 200_000, `${l.name} is ${JSON.stringify(l).length} bytes`);
  assert.equal(layers.reduce((s, l) => s + (l.shapes?.length ?? 0), 0), 3000);
});
