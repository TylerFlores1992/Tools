import { test } from "node:test";
import assert from "node:assert/strict";
import { arcPath, distanceTo, fit, inMarquee, labelOf, panBy, pick, toDrawing, toScreen, translated, unionBounds, zoomAt, type Pt, type VwObject } from "./geometry.ts";

const obj = (id: string, geometry: VwObject["geometry"], bbox: VwObject["bbox"], extra: Partial<VwObject> = {}): VwObject => ({
  id, type: geometry?.kind ?? "symbol", name: "", layer: "L", cls: "None", bbox,
  width: bbox[1][0] - bbox[0][0], height: bbox[1][1] - bbox[0][1], geometry, ...extra,
});

const deck = obj("deck", { kind: "polygon", closed: true, points: [[0, 0], [360, 0], [360, 240], [0, 240]] }, [[0, 0], [360, 240]]);
const edge = obj("edge", { kind: "line", start: [0, 0], end: [360, 0] }, [[0, 0], [360, 0]]);
const fixture = obj("fx", { kind: "bbox" }, [[170, 110], [190, 130]], { plugin: "Lighting Device", channel: "101" });
const ring = obj("ring", { kind: "oval", center: [500, 100], rx: 20, ry: 20 }, [[480, 80], [520, 120]]);
const apron = obj("apron", { kind: "arc", center: [180, 0], radius: 60, start_angle: 180, sweep_angle: 180 }, [[120, -60], [240, 60]]);

test("screen ↔ drawing round-trips, with drawing y pointing up", () => {
  const v = { cx: 100, cy: 50, scale: 2, width: 800, height: 600 };
  const p: Pt = [130, 80];
  const s = toScreen(v, p);
  assert.deepEqual(s, [460, 240]); // above center on screen because y grew
  assert.deepEqual(toDrawing(v, s), p);
});

test("fit shows everything; zoom keeps the point under the cursor still; pan moves by pixels", () => {
  const b = unionBounds([deck, ring])!;
  const v = fit(b, 1000, 500, 20);
  for (const corner of [b[0], b[1]]) {
    const [x, y] = toScreen(v, corner);
    assert.ok(x >= 19.9 && x <= 980.1 && y >= 19.9 && y <= 480.1);
  }
  const s: Pt = [300, 200];
  const z = zoomAt(v, s, 2.5);
  const a = toDrawing(v, s), c = toDrawing(z, s);
  assert.ok(Math.abs(a[0] - c[0]) < 1e-9 && Math.abs(a[1] - c[1]) < 1e-9);
  const p = panBy(v, 10, 0);
  assert.ok(Math.abs(toScreen(p, [v.cx, v.cy])[0] - (v.width / 2 + 10)) < 1e-9);
  assert.deepEqual(fit(null, 400, 300).scale, 1);
});

test("hit distances per shape", () => {
  assert.equal(distanceTo(deck, [100, 100]), 0); // inside a closed shape
  assert.equal(distanceTo(edge, [100, 5]), 5);
  assert.equal(distanceTo(ring, [500, 100]), 0);
  assert.ok(Math.abs(distanceTo(ring, [530, 100]) - 10) < 1e-9);
  assert.ok(Math.abs(distanceTo(apron, [180, -70]) - 10) < 1e-9); // below center: on the arc's side
  assert.ok(distanceTo(apron, [180, 70]) > 50); // top half isn't part of this arc
  assert.equal(distanceTo(fixture, [180, 120]), 0);
});

test("pick prefers the small thing you clicked on over the big thing it sits on", () => {
  const all = [deck, edge, fixture, ring, apron];
  assert.equal(pick(all, [180, 120], 2)?.id, "fx");
  assert.equal(pick(all, [50, 150], 2)?.id, "deck");
  assert.equal(pick(all, [700, 700], 2), null);
  assert.equal(pick(all, [400, 1], 2), null); // past the line's end
});

test("marquee takes whole objects only; translate moves every part", () => {
  assert.deepEqual(inMarquee([deck, fixture, ring], [160, 100], [200, 140]).map((o) => o.id), ["fx"]);
  const t = translated(edge, 12, -6);
  assert.deepEqual(t.geometry, { kind: "line", start: [12, -6], end: [372, -6] });
  assert.deepEqual(t.bbox, [[12, -6], [372, -6]]);
  assert.deepEqual(translated(fixture, 1, 1).bbox, [[171, 111], [191, 131]]);
});

test("labels never show internals", () => {
  assert.equal(labelOf(fixture), "Channel 101");
  assert.equal(labelOf(deck), "Polygon");
  assert.equal(labelOf({ ...deck, name: "Deck" }), "Deck");
  assert.equal(labelOf(obj("s", undefined, [[0, 0], [1, 1]], { type: "rounded_rectangle" })), "Rounded rectangle");
});

test("arcs draw on the right side after the y flip", () => {
  const v = fit([[120, -60], [240, 60]], 200, 200, 0);
  const d = arcPath(v, { kind: "arc", center: [180, 0], radius: 60, start_angle: 180, sweep_angle: 180 });
  assert.match(d, /^M 0 100 A 100 100 0 0 0 200 100$/); // left → right through the bottom
});
