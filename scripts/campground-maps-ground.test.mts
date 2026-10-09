// The ground from lidar point clouds (studio/campground-maps/ground.mjs): the crop of a frame-sized
// PNG to a box in map metres, the GROUND switch, and the check that a PNG belongs to the map's frame.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { GROUND_CREDIT, groundCommand, groundCrop, groundFile, groundImage, groundLabel, groundLayer } from "../studio/campground-maps/ground.mjs";

const FRAME = { x: -330.7, y: -318.6, w: 661.4, h: 637.2 }; // ridb-233379 (Oak Ridge)
const IMG = { width: 1323, height: 1275 }; // ground.py's 0.5 m grid over exactly that frame
type Crop = NonNullable<ReturnType<typeof groundCrop>>;

/** Where an image pixel's centre lands in the output, through the crop. */
function land(c: Crop, u: number, v: number) {
  const ox = c.at.left - c.clip.left + ((u - c.extract.left + 0.5) * c.resize.width) / c.extract.width;
  const oy = c.at.top - c.clip.top + ((v - c.extract.top + 0.5) * c.resize.height) / c.extract.height;
  return [ox, oy];
}

test("the whole frame is the whole image, at the output's size", () => {
  const c = groundCrop(FRAME, IMG, [FRAME.x, FRAME.y, FRAME.x + FRAME.w, FRAME.y + FRAME.h], { width: 1000, height: 963 })!;
  assert.deepEqual(c.extract, { left: 0, top: 0, width: IMG.width, height: IMG.height });
  assert.deepEqual(c.resize, { width: 1000, height: 963 });
  assert.deepEqual(c.at, { left: 0, top: 0 });
});

test("a point in map metres lands where the box puts it (within a pixel), zoomed in or out", () => {
  const boxes: [number, number, number, number, number][] = [
    [-100, -100, 100, 100, 800], // inside, 4 px a metre
    [-300, -300, 300, 300, 1600],
    [-37.3, 12.9, -12.1, 40.4, 1600], // 25 m: 64 px a metre, so whole-pixel edges overhang the box
    [-400, -350, 0, 0, 1000], // reaches past the frame's west and north edges
    [200, 200, 420, 400, 900], // past the east and south edges
  ];
  for (const [x0, y0, x1, y1, W] of boxes) {
    const H = Math.round((W * (y1 - y0)) / (x1 - x0));
    const c = groundCrop(FRAME, IMG, [x0, y0, x1, y1], { width: W, height: H })!;
    assert.ok(c, `${x0},${y0}`);
    assert.ok(c.at.left >= 0 && c.at.top >= 0 && c.at.left + c.clip.width <= W && c.at.top + c.clip.height <= H, "inside the output");
    assert.ok(c.clip.left + c.clip.width <= c.resize.width && c.clip.top + c.clip.height <= c.resize.height, "clip inside the scaled piece");
    const kx = W / (x1 - x0), ky = H / (y1 - y0);
    for (const [mx, my] of [[Math.max(x0, FRAME.x) + 3, Math.max(y0, FRAME.y) + 3], [Math.min(x1, FRAME.x + FRAME.w) - 3, Math.min(y1, FRAME.y + FRAME.h) - 3]]) {
      // The image pixel holding (mx, my), and the output pixel the box puts (mx, my) at.
      const u = Math.floor(((mx - FRAME.x) / FRAME.w) * IMG.width), v = Math.floor(((my - FRAME.y) / FRAME.h) * IMG.height);
      const [ox, oy] = land(c, u, v);
      const px = (FRAME.x + ((u + 0.5) / IMG.width) * FRAME.w - x0) * kx, py = (FRAME.y + ((v + 0.5) / IMG.height) * FRAME.h - y0) * ky;
      assert.ok(Math.abs(ox - px) <= 1 && Math.abs(oy - py) <= 1, `box ${x0},${y0}: (${mx}, ${my}) lands at ${ox.toFixed(1)},${oy.toFixed(1)}, not ${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }
});

test("a box inside the frame is covered edge to edge (no black strip from whole-pixel rounding)", () => {
  for (const [x0, y0, x1, y1, W] of [[-37.3, 12.9, -12.1, 40.4, 1600], [-100.1, -99.7, 100.3, 100.2, 800], [5.13, 7.77, 9.91, 11.04, 1200]]) {
    const H = Math.round((W * (y1 - y0)) / (x1 - x0));
    const c = groundCrop(FRAME, IMG, [x0, y0, x1, y1], { width: W, height: H })!;
    assert.deepEqual(c.at, { left: 0, top: 0 }, `${x0},${y0}`);
    assert.equal(c.at.left + c.clip.width, W, `${x0},${y0}: right edge`);
    assert.equal(c.at.top + c.clip.height, H, `${x0},${y0}: bottom edge`);
  }
});

test("past the frame stays black: the frame's west edge lands where the box puts it", () => {
  const c = groundCrop(FRAME, IMG, [-400, -350, 0, 0], { width: 1000, height: 875 })!;
  assert.equal(c.extract.left, 0);
  assert.equal(c.at.left, Math.round((FRAME.x - -400) * 2.5));
  assert.equal(c.at.top, Math.round((FRAME.y - -350) * 2.5));
});

test("a box that misses the frame has nothing to crop", () => {
  assert.equal(groundCrop(FRAME, IMG, [400, 0, 500, 100], { width: 500, height: 500 }), null);
  assert.equal(groundCrop(FRAME, IMG, [0, -500, 100, -400], { width: 500, height: 500 }), null);
});

test("the crop draws the right pixels (sharp, end to end)", async () => {
  // A 100 x 50 m frame at 0.5 m: the west half white, the east half black.
  const frame = { x: 0, y: 0, w: 100, h: 50 };
  const raw = Buffer.alloc(200 * 100);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) raw[y * 200 + x] = 255;
  const dir = mkdtempSync(join(tmpdir(), "ground-"));
  const png = join(dir, "g.png");
  writeFileSync(png, await sharp(raw, { raw: { width: 200, height: 100, channels: 1 } }).png().toBuffer());
  // Box 40..80 m by 10..30 m at 10 px a metre, plus 20 m past the frame's south edge.
  const out = await sharp(await groundImage(png, frame, [40, 10, 80, 70], { width: 400, height: 600 })).raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => out.data[(y * out.info.width + x) * out.info.channels];
  assert.equal(at(50, 50), 255); // 45 m east: white
  assert.equal(at(150, 50), 0); // 55 m east: black
  assert.equal(at(50, 550), 0); // 65 m south, past the frame: black
  assert.ok(at(95, 100) > 200 && at(105, 100) < 55, "the white/black edge at 50 m lands at 100 px");
});

test("GROUND takes intensity or relief, and nothing else", () => {
  assert.equal(groundLayer(undefined), null);
  assert.equal(groundLayer(""), null);
  assert.equal(groundLayer("intensity"), "intensity");
  assert.equal(groundLayer("relief"), "relief");
  assert.throws(() => groundLayer("photo"), /GROUND=intensity or GROUND=relief/);
  assert.throws(() => groundLayer("toString"), /GROUND=/);
});

test("a ground PNG counts only when it was made for this map's frame", () => {
  const dir = mkdtempSync(join(tmpdir(), "ground-"));
  const map = { facilityId: "233379", bbox: [-77.421895, 38.59653, -77.414303, 38.602271], frame: FRAME };
  const none = groundFile(map, "intensity", dir);
  assert.match(none.problem!, /no intensity\.png for ridb-233379/);
  assert.equal(none.stale, false);
  assert.equal(groundCommand("public/private/camphawk/maps/ridb-233379.json"), "python3 -I studio/campground-maps/pointcloud/ground.py public/private/camphawk/maps/ridb-233379.json");
  mkdirSync(join(dir, "ridb-233379"));
  writeFileSync(join(dir, "ridb-233379", "intensity.png"), "");
  assert.equal(groundFile(map, "intensity", dir).stale, true); // no meta.json
  const meta = { bbox: map.bbox, frame: FRAME, survey: { start: "2022-12-09", end: "2022-12-28" } };
  writeFileSync(join(dir, "ridb-233379", "meta.json"), JSON.stringify(meta));
  const ok = groundFile(map, "intensity", dir);
  assert.equal(ok.problem, null);
  assert.equal(ok.meta.survey.end, "2022-12-28");
  // The map rebuilt with a frame 2 m wider: the PNG would sit in the wrong place.
  assert.match(groundFile({ ...map, frame: { ...FRAME, w: FRAME.w + 2 } }, "intensity", dir).problem!, /another frame/);
  assert.match(groundFile({ ...map, bbox: [...map.bbox.slice(0, 3), 38.603] }, "intensity", dir).problem!, /another frame/);
  assert.equal(groundFile({ ...map, frame: { ...FRAME, x: FRAME.x + 1 } }, "intensity", dir).stale, true);
});

test("the label says it is the point clouds, and when they were flown", () => {
  assert.equal(groundLabel("intensity", { survey: { end: "2022-12-28" } }), "LIDAR INTENSITY (USGS 3DEP points, flown 2022)");
  assert.equal(groundLabel("relief", { survey: { end: null, published: "2026-07-01" } }), "LIDAR GROUND RELIEF (USGS 3DEP points, published 2026)");
  assert.equal(groundLabel("intensity", null), "LIDAR INTENSITY (USGS 3DEP points)");
  assert.match(GROUND_CREDIT, /USGS 3D Elevation Program lidar point cloud \(public domain\)/);
});
