import { test } from "node:test";
import assert from "node:assert/strict";
import { measurement, tools, type Ctx } from "./ai.ts";
import type { Layer, Shape } from "./model.ts";
import { emptySketch } from "../../../src/tools/rig/sketch.ts";

function ctxWith(layers: Layer[]) {
  const visible: Record<string, boolean> = {};
  const put: { name: string; shapes: Shape[] }[] = [];
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
  };
  const state = { sketch: ctx.sketch, changed: false, notes: [] as string[] };
  return { ctx, state, visible, put, run: (name: string, input: Record<string, unknown>) => tools(ctx, state).find((t) => t.name === name)!.execute(input) };
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
