import { test } from "node:test";
import assert from "node:assert/strict";
import { measurement, tools, type Ctx } from "./ai.ts";
import type { Layer, Shape } from "./model.ts";
import { emptySketch } from "../../../src/tools/rig/sketch.ts";

function ctxWith(layers: Layer[]) {
  const visible: Record<string, boolean> = {};
  const put: { name: string; shapes: Shape[]; reference?: Layer["reference"] }[] = [];
  const ctx: Ctx = {
    sketch: emptySketch("T"),
    layers,
    history: [],
    projectName: "T",
    onDraft() {},
    onProgress() {},
    startSession: async () => "j",
    setVisible: async (ids, v) => ids.forEach((id) => (visible[id] = v)),
    putMeasurements: async (name, shapes) => (put.push({ name, shapes }), "m1"),
    putReference: async (name, shapes, reference) => (put.push({ name, shapes, reference }), "ref1"),
  };
  const state = { sketch: ctx.sketch, changed: false, notes: [] as string[] };
  return { ctx, state, visible, put, run: (name: string, input: Record<string, unknown>) => tools(ctx, state).find((t) => t.name === name)!.execute(input, { signal: new AbortController().signal }) };
}

const deck: Layer = { id: "d", name: "CFF: CFF SET-26", kind: "shapes", visible: true, at: "t", shapes: [{ pts: [[0, 0], [96, 0], [96, 48], [0, 48]], closed: true, z: 24 }, { pts: [[500, 500], [510, 500], [510, 510]], closed: true }] };
const venue: Layer = { id: "v", name: "CFF: 2D_Trillith", kind: "shapes", visible: true, at: "t", shapes: [] };

test("looking changes nothing in the rig: just the deck, then its measurements", async () => {
  const { state, visible, put, run } = ctxWith([deck, venue]);
  await run("show_layers", { only: ["d"] });
  assert.deepEqual(visible, { v: false }, "only the other drawing layer is hidden");
  const read = (await run("read_layer", { id: "d", area: [-10, -10, 200, 200] })) as { count: number; shapes: { box: number[] }[] };
  assert.equal(read.count, 1, "the area keeps what's inside it");
  assert.deepEqual(read.shapes[0].box, [0, 0, 96, 48]);
  await run("add_measurements", { name: "Deck layout", dims: [{ a: [0, 0], b: [96, 0], offset: -24 }, { a: [0, 0], b: [0, 48], label: "4' deep" }] });
  assert.equal(put[0].name, "Measurements: Deck layout");
  assert.deepEqual(put[0].shapes.map((s) => s.text), ["8'", "4' deep"]);
  assert.equal(state.changed, false, "no version: the rig wasn't touched");
});

test("a dimension line is moved off the objects and reads upright", () => {
  const m = measurement([0, 0], [120, 0], undefined, -24, 1);
  assert.deepEqual(m.pts.slice(1), [[0, -24], [120, -24]]);
  assert.equal(m.dim, 1);
  assert.ok(Math.abs(m.rot ?? 0) <= 90);
  const up = measurement([0, 100], [0, 0], undefined, 0, 1);
  assert.ok((up.rot ?? 0) > -90 && (up.rot ?? 0) <= 90, "never upside down");
});

test("the X and Y reference lines are drawn across the drawing, named, with distances off each other", async () => {
  const { fromReference } = await import("./reference.ts");
  const { state, put, run, visible } = ctxWith([deck, venue]);
  const res = (await run("set_reference", { origin: [48, 0], x_line: "DS edge", y_line: "CL" })) as { layer: string };
  assert.equal(res.layer, "Reference: CL / DS edge");
  const r = put[0];
  assert.deepEqual(r.reference, { origin: [48, 0], xLine: "DS edge", yLine: "CL", stepFt: 5 });
  const lines = r.shapes.filter((s) => !s.text && s.pts.length === 2);
  const across = lines.find((s) => s.pts[0][1] === 0 && s.pts[1][1] === 0 && s.pts[1][0] - s.pts[0][0] > 510);
  const upDown = lines.find((s) => s.pts[0][0] === 48 && s.pts[1][0] === 48 && s.pts[1][1] - s.pts[0][1] > 510);
  assert.ok(across && upDown, "both lines run past everything shown (the deck reaches 510\")");
  const words = r.shapes.map((s) => s.text).filter(Boolean);
  assert.ok(words.includes("DS edge (Y = 0)") && words.includes("CL (X = 0)"), "each line says its name, in words");
  assert.ok(words.includes("5' HR") && words.includes("5' HL") && words.includes("10' US"), "a figure every 5' says how far and which side");
  assert.equal(fromReference(r.reference!, [60, 96]), "1' HR of CL, 8' US of DS edge");
  const at = (t: string) => r.shapes.find((s) => s.text === t)!.pts[0];
  assert.ok(at("5' HR")[0] > 48 && at("5' HL")[0] < 48 && at("10' US")[1] > 0, "HR is +X (house right), US is +Y (away from the audience)");
  assert.equal(state.changed, false, "no version: the rig wasn't touched");
  const withRef = ctxWith([deck, venue, { id: "ref1", name: res.layer, kind: "shapes", visible: true, at: "t", shapes: r.shapes, reference: r.reference }]);
  await withRef.run("show_layers", { only: ["d"] });
  assert.deepEqual(withRef.visible, { v: false }, "showing only the deck keeps the reference lines");
  void visible;
});

test("questions that never got an answer are left out, so Claude answers only the new one", async () => {
  const { turns } = await import("./ai.ts");
  const m = (role: "you" | "claude", text: string) => ({ role, text, at: "t" });
  const history = [
    m("you", "How deep is the FOH deck?"),
    m("claude", "20' deep."),
    m("you", "This is just the FOH, I want all deck"),
    m("you", "Does vectorworks have a labeled x and y axis?"),
    m("you", "Does vectorworks have a labeled x and y axis?"),
  ];
  const t = turns(history, "Restore all layers back to normal");
  assert.deepEqual(t.map((x) => x.role), ["user", "assistant", "user"]);
  assert.equal(t[2].content, "Restore all layers back to normal", "the dropped questions don't ride along");
  assert.equal(turns([m("you", "a"), m("claude", "b")], "c")[2].content, "c", "an answered question stays");
});
