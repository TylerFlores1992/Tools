// A Vectorworks read-out becomes fixtures, the existing rig and outlines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isReadout, readoutLayers, readoutViews, readoutSummary, type Readout } from "./readout.ts";

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
      { t: "extrude", layer: "Set", cls: "None", bbox: [0, 0, 10, 10], pts: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, z: [0, 30], mid: 0 },
      { t: "extrude", layer: "Set", cls: "None", bbox: [0, 0, 10, 10], pts: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, z: [0, 30], mid: 7 },
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

test("a symbol with no 2D graphics shows its 3D part in Plan too, as Vectorworks draws it from above", () => {
  const sq = (x: number): [number, number][] => [[x, 0], [x + 96, 0], [x + 96, 48], [x, 48]];
  const r: Readout = {
    readout: 1, document: "Set.vwx", units: "in", classes: [],
    layers: [{ name: "Set", type: "design", elevation: 0, visible: true }],
    objects: [
      // A hybrid deck: plan graphics and a 3D part.
      { t: "symbol", layer: "Set", cls: "None", bbox: [0, 0, 96, 48], symbol: "Hybrid deck" },
      { t: "rectangle", layer: "Set", cls: "None", bbox: [0, 0, 96, 48], pts: sq(0), closed: true, in: "Hybrid deck", view: "plan" },
      { t: "extrude", layer: "Set", cls: "None", bbox: [0, 0, 96, 48], pts: sq(0), closed: true, z: [0, 24], in: "Hybrid deck", view: "3d" },
      // A 3D-only deck (Weakest Link's): its 3D part is all Plan has of it.
      { t: "symbol", layer: "Set", cls: "None", bbox: [200, 0, 296, 48], symbol: "Deck 4'x8'" },
      { t: "type_84", layer: "Set", cls: "None", bbox: [200, 0, 296, 48], pts: sq(200), closed: true, z: [0, 24], in: "Deck 4'x8'", view: "3d" },
      { t: "type_84", layer: "Set", cls: "None", bbox: [200, 0, 296, 48], pts: sq(200), closed: true, z: [0, 4], in: "Deck 4'x8'", view: "3d" },
    ],
  };
  const shapes = readoutLayers(r, { name: "Set.rigread.json", from: "dropbox" }, "t").find((l) => l.kind === "shapes")!.shapes!;
  assert.deepEqual(shapes.map((s) => s.v ?? "both"), ["plan", "3d", "both", "both"]);
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

test("flat fills keep the drawing's order: layer order first, then each object's place", () => {
  const sq = (x: number): [number, number][] => [[x, 0], [x + 10, 0], [x + 10, 10], [x, 10]];
  const r: Readout = {
    readout: 1, document: "Set.vwx", units: "in", classes: [],
    layers: [
      { name: "Venue", type: "design", elevation: 0, visible: true },
      { name: "Set", type: "design", elevation: 0, visible: true },
    ],
    objects: [
      // as split files return them: out of order, with k
      { t: "rectangle", layer: "Set", cls: "None", bbox: [0, 0, 10, 10], pts: sq(0), closed: true, fill: "#555555", k: 2 },
      { t: "polyline", layer: "Venue", cls: "None", bbox: [0, 0, 10, 10], pts: sq(0), closed: true, fill: "#ffff00", fo: 22, z: [0, 0], k: 0 },
      { t: "rectangle", layer: "Venue", cls: "None", bbox: [0, 0, 10, 10], pts: sq(20), closed: true, fill: "#ffffff", k: 1 },
    ],
  };
  const all = readoutLayers(r, { name: "Set.rigread.json", from: "dropbox" }, "t").flatMap((l) => l.shapes ?? []);
  const by = (fill: string) => all.find((s) => s.fill === fill)!;
  assert.ok(by("#ffff00").n! < by("#ffffff").n! && by("#ffffff").n! < by("#555555").n!, "the venue floor under the set's deck");
  assert.equal(by("#ffff00").fo, 22, "a see-through fill keeps its opacity");
  assert.equal(by("#ffff00").m, undefined, "a flat shape is a fill, not faces");
});

test("pens, weights, words and switched-off classes come through as Vectorworks draws them", () => {
  const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const r: Readout = {
    readout: 1, document: "Set.vwx", units: "in", classes: [],
    layers: [{ name: "Plan", type: "design", elevation: 24, visible: true }],
    objects: [
      { t: "rectangle", layer: "Plan", cls: "Walls", bbox: [0, 0, 10, 10], pts: sq, closed: true, pen: "#ff0000", lw: 20, hatch: 1 },
      { t: "rectangle", layer: "Plan", cls: "Off", bbox: [0, 0, 10, 10], pts: sq, closed: true, hid: 1 },
      { t: "rectangle", layer: "Plan", cls: "Thin", bbox: [0, 0, 10, 10], pts: sq, closed: true, lw: 5, fill: "#ffffff", np: 1 },
      { t: "text", layer: "Plan", cls: "Notes", bbox: [5, 5, 5, 5], at: [5, 5, 0], text: "\rELEPHANT\rDOOR", size: 14, rot: 90 },
      { t: "dimension", layer: "Plan", cls: "Dimension", bbox: [0, 0, 0, 0], at: [0, -5, 0], pts: [[0, 0], [10, 0]], text: "10\"", size: 9 },
      { t: "text", layer: "Plan", cls: "Off", bbox: [0, 0, 0, 0], at: [0, 0, 0], text: "hidden", size: 9, hid: 1 },
    ],
  };
  const all = readoutLayers(r, { name: "Set.rigread.json", from: "dropbox" }, "t").flatMap((l) => l.shapes ?? []);
  assert.equal(all.length, 4, "the two objects in a switched-off class are left out");
  const wall = all[0];
  assert.deepEqual([wall.pen, wall.lw, wall.hatch], ["#ff0000", 20, 1]);
  assert.equal(all[1].lw, undefined, "a hairline stays a plain line");
  assert.equal(all[1].np, 1, "no pen: fill only");
  const text = all.find((s) => s.text && !s.dim)!;
  assert.equal(text.text, "ELEPHANT\nDOOR", "Vectorworks' line breaks, without the leading one");
  assert.deepEqual([text.pts, text.size, text.rot, text.z], [[[5, 5]], 14, 90, 24]);
  const dim = all.find((s) => s.dim)!;
  assert.deepEqual(dim.pts, [[0, -5], [0, 0], [10, 0]], "a dimension: its figure's point, then its two ends");
});

test("a read-out can be shown as a sheet's viewport: its layers and classes", () => {
  const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const r: Readout = {
    readout: 1, document: "Set.vwx", units: "in", classes: [],
    layers: [{ name: "Set", type: "design", visible: true }, { name: "Venue 3D", type: "design", visible: false }],
    hidden_classes: ["Logos"],
    viewports: [{ sheet: "A-1", name: "Plan", layers: { Set: 0, "Venue 3D": 0 }, classes: { Logos: 0, Cameras: -1 } }],
    objects: [
      { t: "rectangle", layer: "Set", cls: "Logos", bbox: [0, 0, 10, 10], pts: sq, closed: true, hid: 1 },
      { t: "symbol", layer: "Set", cls: "Cameras", bbox: [0, 0, 10, 10], symbol: "Ped", at: [0, 0, 0] },
      { t: "rectangle", layer: "Set", cls: "None", in: "Ped", bbox: [0, 0, 10, 10], pts: sq, closed: true },
      { t: "rectangle", layer: "Venue 3D", cls: "None", bbox: [0, 0, 10, 10], pts: sq, closed: true },
    ],
  };
  assert.deepEqual(readoutViews(r).map((v) => v.label), ["Design layers", "Sheet A-1 (Plan)"]);
  const src = { name: "Set.rigread.json", from: "dropbox" as const };
  const design = readoutLayers(r, src, "t");
  assert.equal(design.flatMap((l) => l.shapes ?? []).length, 2, "design layers: the logo's class is off");
  assert.equal(design.find((l) => l.name.endsWith("Venue 3D"))?.visible, false);
  const sheet = readoutLayers(r, src, "t", "A-1/Plan");
  const set = sheet.find((l) => l.name.endsWith(": Set"))!;
  assert.equal(set.shapes!.length, 1, "the sheet shows the logo and hides the camera with its parts");
  assert.equal(sheet.find((l) => l.name.endsWith("Venue 3D"))?.visible, true, "the sheet shows the venue layer");
});

test("lights and rig on layers Vectorworks hides start hidden, and a ring of truss isn't one box", () => {
  const r: Readout = {
    ...SAMPLE,
    layers: [
      { name: "Stage", type: "design", elevation: 0, visible: true },
      { name: "Lighting", type: "design", elevation: 0, visible: false },
      { name: "Rigging", type: "design", elevation: 0, visible: true },
    ],
    objects: [
      ...SAMPLE.objects,
      // Weakest Link's 80' circle of truss: a box its size would be a slab over the whole stage.
      { t: "symbol", layer: "Rigging", cls: ".RIG TRUSS", bbox: [-510, -510, 510, 510], at: [0, 0, 192], rot: 0, symbol: "Circle 20x80ft" },
      { t: "symbol", layer: "Rigging", cls: ".RIG TRUSS", bbox: [-300, -280, 300, 280], at: [0, 0, 303], rot: 0, symbol: "Box Truss 20.5 Ring" },
    ],
  };
  const layers = readoutLayers(r, { name: "WL.rigread.json", from: "dropbox" }, "t");
  const shown = layers.find((l) => l.name === "WL: lighting");
  const hidden = layers.find((l) => l.name === "WL: lighting on hidden layers")!;
  assert.equal(shown, undefined, "no lights shown: their layer is hidden in Vectorworks");
  assert.ok(hidden && hidden.visible === false && hidden.fixtures!.length === 2, "they're kept in a row that starts hidden");
  const rig = layers.find((l) => l.name === "WL: existing rig")!;
  assert.ok(rig.visible && rig.rig!.length === 5, "the truss and hoist on the shown layer, listed");
  assert.ok(rig.rig!.filter((x) => /Circle|Ring/.test(x.name)).every((x) => x.drawn), "a circle or ring of truss isn't boxed: its own parts draw it");
});

test("a building around the whole drawing gets its own row, starting hidden, so the set inside shows", () => {
  const box = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const r: Readout = {
    readout: 1,
    document: "WL.vwx",
    units: "in",
    layers: [{ name: "Stage", type: "design", elevation: 0, visible: true }, { name: "Decking", type: "design", elevation: 0, visible: true }],
    classes: ["None"],
    objects: [
      // The venue: 50' walls and a roof plate around everything, and its floor markings.
      { t: "type_84", layer: "Stage", cls: "None", bbox: [-1069, -855, 920, 968], pts: box(-1069, -855, 920, 968), closed: true, z: [0, 602] },
      { t: "type_24", layer: "Stage", cls: "None", bbox: [-1051, -841, 904, 947], pts: box(-1051, -841, 904, 947), closed: true, z: [614, 618] },
      { t: "polygon", layer: "Stage", cls: "None", bbox: [-1069, -855, 920, 968], pts: box(-1069, -855, 920, 968), closed: true, z: [0, 0] },
      { t: "line", layer: "Stage", cls: "None", bbox: [-1000, 0, 900, 0], pts: [[-1000, 0], [900, 0]], z: [0, 0] },
      // Its side wall and a door frame in a corner, along its outline: they go with it.
      { t: "type_24", layer: "Stage", cls: "S-STRS", bbox: [-1055, -405, -996, 732], pts: box(-1055, -405, -996, 732), closed: true, z: [0, 658] },
      { t: "type_84", layer: "Stage", cls: "None", bbox: [-1057, 854, -963, 956], pts: box(-1057, 854, -963, 956), closed: true, z: [0, 114] },
      // A bollard by the wall (too short) and a tall scenic piece in the middle of the floor: they stay.
      { t: "type_24", layer: "Stage", cls: "None", bbox: [-1064, -748, -1056, -740], pts: box(-1064, -748, -1056, -740), closed: true, z: [0, 48] },
      { t: "type_24", layer: "Stage", cls: "None", bbox: [-20, -20, 20, 20], pts: box(-20, -20, 20, 20), closed: true, z: [0, 300] },
      // A deck and a tall scenic tower inside: not buildings.
      { t: "type_24", layer: "Decking", cls: "None", bbox: [-100, -100, 100, 100], pts: box(-100, -100, 100, 100), closed: true, z: [0, 73] },
      { t: "type_24", layer: "Decking", cls: "None", bbox: [300, 300, 340, 340], pts: box(300, 300, 340, 340), closed: true, z: [0, 400] },
    ],
  };
  const layers = readoutLayers(r, { name: "WL.rigread.json", from: "dropbox" }, "t");
  const building = layers.find((l) => l.name === "WL: building around everything")!;
  assert.ok(building && building.visible === false && building.shapes!.length === 4, "walls, roof, side wall and door frame, starting hidden");
  const stage = layers.find((l) => l.name === "WL: Stage")!;
  assert.ok(stage.visible && stage.shapes!.length === 4, "the venue's floor lines, the bollard and the scenic piece stay with the Stage, shown");
  assert.equal(layers.find((l) => l.name === "WL: Decking")!.shapes!.length, 2, "the deck and the tower stay put");
});

test("faces shared by every copy of a symbol part are drawn at each copy, from the main file or a part", async () => {
  const { attachMeshes } = await import("./readout.ts");
  const m = { q: 0.25, v: [0, 0, 0, 384, 0, 0, 384, 192, 0, 0, 192, 24], f: [4, 0, 1, 2, 3] };
  const copy = (x: number) => ({ t: "type_84", layer: "Decking", cls: "None", bbox: [x, 0, x + 96, 48] as [number, number, number, number], in: "Deck 4x8", pts: [[x, 0], [x + 96, 0], [x + 96, 48], [x, 48]] as [number, number][], closed: true, z: [67, 73] as [number, number], sm: "0", mx: [1, 0, 0, 0, 1, 0, 0, 0, 1, x, 0, 67] });
  const r: Readout = { readout: 1, document: "WL.vwx", units: "in", layers: [{ name: "Decking", type: "design", elevation: 0, visible: true }], classes: ["None"], objects: [copy(0), copy(200)], shared: { "0": m } };
  const shapes = readoutLayers(r, { name: "WL.rigread.json", from: "dropbox" }, "t").find((l) => l.name === "WL: Decking")!.shapes!;
  assert.ok(shapes.every((s) => s.m === m), "one set of faces for both copies");
  assert.deepEqual(shapes.map((s) => s.mx![9]), [0, 200], "each copy keeps its own place");
  // Split into part files: the faces come once as "s0".
  const split: Readout = { ...r, shared: undefined, objects: r.objects.map(({ sm: _sm, ...o }) => ({ ...o, mid: "s0" })) };
  assert.equal(attachMeshes(split, [{ meshes: { s0: m } }]), 2);
  assert.ok(readoutLayers(split, { name: "WL.rigread.json", from: "dropbox" }, "t").find((l) => l.name === "WL: Decking")!.shapes!.every((s) => s.m === m && s.mx));
});

test("truss drawn by its own symbol parts isn't boxed again (stood-up towers, spacers, runs)", () => {
  const r: Readout = {
    readout: 1, document: "WL.vwx", units: "in", classes: ["None"],
    layers: [{ name: "Decking", type: "design", elevation: 0, visible: true }],
    objects: [
      { t: "symbol", layer: "Decking", cls: "None", bbox: [0, 0, 20, 96], at: [0, 0, 0], rot: 0, symbol: `Truss 20.5" Box 8' (SLV)`, rot3d: [90, 0, 0] },
      { t: "symbol", layer: "Decking", cls: "None", bbox: [100, 0, 120, 20], at: [100, 0, 0], rot: 0, symbol: `Truss 20.5" Box Spacer 4" (SLV)` },
      { t: "symbol", layer: "Decking", cls: "None", bbox: [200, 0, 296, 20], at: [200, 10, 120], rot: 0, symbol: `Truss 20.5" Box 8' (SLV)` },
    ],
  };
  const rig = readoutLayers(r, { name: "WL.rigread.json", from: "dropbox" }, "t").find((l) => l.kind === "rig")!;
  assert.ok(rig.rig!.length === 3 && rig.rig!.every((x) => x.drawn), "listed for Claude, never boxed over their own parts");
});
