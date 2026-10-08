import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { campgroundOutline, firstComeFrame, isFirstCome, polygonsOf, OUTLINE_REACH_M } from "./first-come.ts";
import type { SiteMapData } from "./index.ts";

const map = (outline: string, at: [number, number] = [0, 0], name = "Standard") =>
  ({ frame: { x: -700, y: -700, w: 1400, h: 1400 }, evidence: { outline, pitches: [] }, sites: [{ name, type: "STANDARD NONELECTRIC", at }] }) as unknown as SiteMapData;

test("a first-come listing is one site named Standard, nothing else", () => {
  assert.equal(isFirstCome(map("")), true);
  assert.equal(isFirstCome(map("", [0, 0], " standard ")), true);
  assert.equal(isFirstCome(map("", [0, 0], "001")), false);
  assert.equal(isFirstCome({ ...map(""), sites: [map("").sites[0], map("").sites[0]] } as SiteMapData), false);
});

test("an outline path splits into its polygons", () => {
  assert.deepEqual(polygonsOf("M0 0L10 0L10 10ZM100 100L110 100L110 110Z"), [[[0, 0], [10, 0], [10, 10]], [[100, 100], [110, 100], [110, 110]]]);
  assert.deepEqual(polygonsOf(""), []);
});

test("the campground's outline is the one holding the point, else the nearest within reach, else none", () => {
  const square = (x: number, y: number, s: number) => `M${x} ${y}L${x + s} ${y}L${x + s} ${y + s}L${x} ${y + s}Z`;
  // Point inside the second polygon: that one, 0 m outside.
  const a = campgroundOutline(map(square(300, 300, 50) + square(-50, -50, 100)))!;
  assert.equal(a.pointOutsideM, 0);
  assert.deepEqual(a.ring[0], [-50, -50]);
  // Point on the road 40 m south of the outline: that outline, 40 m.
  const b = campgroundOutline(map(square(-50, -140, 100)))!;
  assert.equal(Math.round(b.pointOutsideM), 40);
  // The nearest of two when the point is in neither.
  assert.deepEqual(campgroundOutline(map(square(60, 0, 20) + square(-200, 0, 20)))!.ring[0], [60, 0]);
  // Beyond reach: someone else's campground.
  assert.equal(campgroundOutline(map(square(OUTLINE_REACH_M + 10, 0, 50))), null);
  assert.equal(campgroundOutline(map("")), null);
});

test("the frame holds the outline and the point with room, keeps the aspect and a minimum size", () => {
  const f = firstComeFrame(map("M-50 -50L50 -50L50 50L-50 50Z", [0, 120]), 1, 300);
  // The point (0, 120) and the outline's corners are inside, with room.
  assert.ok(f.x < -50 && f.x + f.w > 50 && f.y < -50 && f.y + f.h > 120);
  assert.equal(Math.round(f.w), Math.round(f.h));
  const wide = firstComeFrame(map("M-50 -50L50 -50L50 50L-50 50Z"), 2, 300);
  assert.equal(Math.round(wide.w / wide.h), 2);
  // No outline: minSide around the point.
  const none = firstComeFrame(map("", [10, 20]), 1, 420);
  assert.equal(Math.round(none.w), 420);
  assert.equal(Math.round(none.x + none.w / 2), 10);
});

test("the comps' examples are first-come listings with facts from RIDB", () => {
  const ex = JSON.parse(readFileSync(new URL("./first-come-examples.json", import.meta.url), "utf8"));
  const ids = Object.keys(ex.facts);
  assert.ok(ids.length >= 4);
  for (const id of ids) {
    const m = JSON.parse(readFileSync(new URL(`../../../../../public/private/camphawk/maps/ridb-${id}.json`, import.meta.url), "utf8"));
    assert.equal(isFirstCome(m), true, id);
    assert.equal(ex.facts[id].id, id);
  }
});

test("a campground's restrooms are the ones by its outline (or its point), not the next campground's", async () => {
  const { campgroundRestrooms } = await import("./first-come.ts");
  const m = { ...map("M-50 -50L50 -50L50 50L-50 50Z"), pois: [
    { name: "", type: "Restroom", at: [0, 0] }, { name: "", type: "Restroom", at: [190, 0] },
    { name: "", type: "Restroom", at: [400, 0] }, { name: "", type: "Water", at: [0, 10] }] } as unknown as SiteMapData;
  assert.deepEqual(campgroundRestrooms(m).map((p) => p.at[0]), [0, 190]);
  const bare = { ...map("", [0, 0]), pois: m.pois } as unknown as SiteMapData;
  assert.deepEqual(campgroundRestrooms(bare).map((p) => p.at[0]), [0, 190]);
});

test("the outline's label sits on its top edge above its middle, not on a tip at one end", async () => {
  const { outlineLabelAt } = await import("./first-come.ts");
  // A long strip with a tall tip at its east end (Elbert Creek's shape).
  const ring: [number, number][] = [[0, 0], [200, -10], [380, -60], [400, 0], [380, 20], [0, 20]];
  const [x, y] = outlineLabelAt(ring);
  assert.ok(x > 150 && x < 250, `x ${x}`);
  assert.equal(y, -10);
});
