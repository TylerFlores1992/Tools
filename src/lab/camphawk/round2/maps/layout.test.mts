import assert from "node:assert/strict";
import test from "node:test";
import { mapFor } from "./index.ts";
import { findSite, placeNumbers, toPx, type Box } from "./layout.ts";

const map = mapFor("upper-pines")!;
const opts = { charPx: 12 * 0.62, linePx: 15 };
const boxOf = (cx: number, cy: number, name: string): Box => {
  const w = name.length * opts.charPx + 4, h = opts.linePx;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
};
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test("before the map is measured, no numbers are placed (the dots still draw)", () => {
  assert.deepEqual(placeNumbers(map, map.sites, 0, [], opts), []);
});

for (const width of [350, 900, 1250]) {
  test(`at ${width}px no two numbers touch, none touches an obstacle, and each sits by its own dot`, () => {
    const obstacle: Box = { x0: width / 2 - 20, y0: width / 2 - 20, x1: width / 2 + 20, y1: width / 2 + 20 };
    const placed = placeNumbers(map, map.sites, width, [obstacle], opts);
    const boxes = placed.map((p) => boxOf(p.cx, p.cy, p.name));
    boxes.forEach((b, i) => {
      assert.ok(!overlaps(b, obstacle), `${placed[i].name} covers the obstacle`);
      boxes.slice(i + 1).forEach((c, j) => assert.ok(!overlaps(b, c), `${placed[i].name} touches ${placed[i + 1 + j].name}`));
      const [dx, dy] = toPx(map, map.sites.find((s) => s.name === placed[i].name)!.at!, width);
      assert.ok(Math.hypot(placed[i].cx - dx, placed[i].cy - dy) < 30, `${placed[i].name} drifted from its dot`);
    });
  });
}

test("zoomed in (the map drawn 1250px wide), at least 70% of sites get their number", () => {
  const placed = placeNumbers(map, map.sites, 1250, [], opts);
  assert.ok(placed.length / map.sites.length >= 0.7, `only ${placed.length} of ${map.sites.length}`);
});

test("find a site: by its number however it's typed, and nothing for a site that isn't there", () => {
  assert.equal(findSite(map, "157")?.name, "157");
  assert.equal(findSite(map, " site 42 ")?.name, "042");
  assert.equal(findSite(map, "#9")?.name, "009");
  assert.equal(findSite(map, "999"), null);
  assert.equal(findSite(map, ""), null);
  assert.equal(findSite(map, "abc"), null);
});
