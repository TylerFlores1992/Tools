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

test("3D objects come as blocks in their own colour, and layers start shown as in the drawing", () => {
  const r: Readout = {
    readout: 1,
    document: "Set.vwx",
    units: "in",
    layers: [
      { name: "CFF SET-26", type: "design", visible: true, elevation: 12 },
      { name: "CNC LAYOUT", type: "design", visible: false },
    ],
    classes: [],
    objects: [
      { t: "polygon", layer: "CFF SET-26", cls: "None", bbox: [0, 0, 10, 4], pts: [[0, 0], [10, 0], [10, 4], [0, 4]], closed: true, z: [0, 36], fill: "#ff0000", in: "Podium" },
      { t: "line", layer: "CNC LAYOUT", cls: "None", bbox: [0, 0, 5, 0], pts: [[0, 0], [5, 0]] },
      { t: "symbol", layer: "CFF SET-26", cls: "None", bbox: [0, 0, 1, 1], symbol: "Truss 10ft", at: [0, 0, 0], in: "Big Set" },
    ],
  };
  const out = readoutLayers(r, { name: "Set.vwx", from: "vectorworks" } as never, "now");
  const set = out.find((l) => l.name === "Set: CFF SET-26")!;
  assert.deepEqual(set.shapes![0], { pts: [[0, 0], [10, 0], [10, 4], [0, 4]], z: 12, closed: true, h: 36, fill: "#ff0000" });
  assert.equal(set.visible, true);
  assert.equal(out.find((l) => l.name === "Set: CNC LAYOUT")!.visible, false);
  assert.ok(!out.some((l) => l.kind === "rig"), "a truss symbol nested inside another symbol isn't a separate rig piece");
});

test("real 3D faces come through to the layer, also from part files", async () => {
  const { attachMeshes } = await import("./readout.ts");
  const box = { q: 0.25, v: [0, 0, 0, 40, 0, 0, 40, 40, 0, 0, 40, 0], f: [4, 0, 1, 2, 3] };
  const r: Readout = {
    readout: 1, document: "Set.vwx", units: "in", classes: [],
    layers: [{ name: "Set", type: "design", elevation: 24, visible: true }],
    objects: [
      { t: "extrude", layer: "Set", cls: "None", bbox: [0, 0, 10, 10], pts: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, z: [0, 0], mid: 0 },
      { t: "extrude", layer: "Set", cls: "None", bbox: [0, 0, 10, 10], pts: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, z: [0, 0], mid: 7 },
    ],
    mesh_parts: ["Set.rigmesh1.json"],
  };
  assert.equal(attachMeshes(r, [{ meshes: { "0": box } }]), 1, "only the object whose faces arrived gets them");
  const shapes = readoutLayers(r, { name: "Set.rigread.json", from: "dropbox" }, "2026-11-10T00:00:00Z").find((l) => l.kind === "shapes")!.shapes!;
  const withFaces = shapes.filter((s) => s.m);
  assert.equal(withFaces.length, 1);
  assert.deepEqual(withFaces[0].m, box);
  assert.equal(withFaces[0].mz, 24, "the layer's elevation goes with the faces");
  assert.equal(shapes.filter((s) => !s.m).length, 1, "the other still draws as its block");
});

test("a hybrid symbol's plan graphics and 3D part keep their view", () => {
  const r: Readout = {
    readout: 1, document: "Set.vwx", units: "in", classes: [],
    layers: [{ name: "Set", type: "design", elevation: 0, visible: true }],
    objects: [
      { t: "rectangle", layer: "Set", cls: "None", bbox: [0, 0, 96, 48], pts: [[0, 0], [96, 0], [96, 48], [0, 48]], closed: true, fill: "#555555", in: "Deck", view: "plan" },
      { t: "extrude", layer: "Set", cls: "None", bbox: [0, 0, 96, 48], pts: [[0, 0], [96, 0], [96, 48], [0, 48]], closed: true, z: [0, 24], in: "Deck", view: "3d" },
      { t: "line", layer: "Set", cls: "None", bbox: [0, 0, 10, 0], pts: [[0, 0], [10, 0]] },
    ],
  };
  const shapes = readoutLayers(r, { name: "Set.rigread.json", from: "dropbox" }, "t").find((l) => l.kind === "shapes")!.shapes!;
  assert.deepEqual(shapes.map((s) => s.v ?? "both"), ["plan", "3d", "both"]);
  assert.equal(shapes[0].fill, "#555555", "the plan's deck keeps its fill");
});

test("shapes spilled into part files come back", async () => {
  const { attachMeshes } = await import("./readout.ts");
  const r: Readout = {
    readout: 1, document: "Set.vwx", units: "in", classes: [],
    layers: [{ name: "Plan", type: "design", elevation: 0, visible: true }],
    objects: [{ t: "line", layer: "Plan", cls: "None", bbox: [0, 0, 1, 0], pts: [[0, 0], [1, 0]] }],
    mesh_parts: ["Set.rigmesh1.json"],
  };
  attachMeshes(r, [{ objects: [{ t: "line", layer: "Plan", cls: "None", bbox: [0, 1, 1, 1], pts: [[0, 1], [1, 1]] }] }]);
  const shapes = readoutLayers(r, { name: "Set.rigread.json", from: "dropbox" }, "t").find((l) => l.kind === "shapes")!.shapes!;
  assert.equal(shapes.length, 2);
});
