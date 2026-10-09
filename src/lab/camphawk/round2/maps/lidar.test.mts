import assert from "node:assert/strict";
import test from "node:test";
import { LIDAR, LIDAR_SOURCES, decodeBip, lidarRelief, lidarSize, lidarSourcesFor, lidarUrl, metresPerPx, mostlyMissing, inOregon } from "./lidar.ts";

const box: [number, number, number, number] = [-93.05, 34.48, -93.04, 34.49];

test("the request asks for raw elevation in degrees, so pixels line up with the map's metres", () => {
  const u = new URL(lidarUrl(box, { width: 900, height: 1100 }));
  assert.equal(u.origin + u.pathname, LIDAR.service);
  assert.equal(u.searchParams.get("format"), "bip");
  assert.equal(u.searchParams.get("pixelType"), "F32");
  assert.equal(u.searchParams.get("bboxSR"), "4326");
  assert.equal(u.searchParams.get("imageSR"), "4326");
  assert.equal(u.searchParams.get("size"), "900,1100");
  assert.deepEqual(JSON.parse(u.searchParams.get("renderingRule")!), { rasterFunction: "None" });
  assert.equal(new URL(lidarUrl(box, { width: 9, height: 9 }, LIDAR_SOURCES.dogami)).hostname, "gis.dogami.oregon.gov");
});

test("pixel sizes: square in degrees (the service widens the box otherwise), the metres asked for north-south, never past the limit", () => {
  for (const b of [box, [-121.3, 38.0, -121.29, 38.01], [-150.1, 61.0, -150.09, 61.005]] as [number, number, number, number][]) {
    const s = lidarSize(b, 0.6);
    const degW = (b[2] - b[0]) / s.width, degH = (b[3] - b[1]) / s.height;
    assert.ok(Math.abs(degW / degH - 1) < 0.01, `pixels ${degW} x ${degH} degrees`);
    const [mx, my] = metresPerPx(b, s);
    assert.ok(Math.abs(my - 0.6) < 0.01 && mx <= 0.6, `${mx} ${my}`);
  }
  const big = lidarSize([-93.2, 34.3, -93.0, 34.5], 0.5);
  assert.ok(Math.max(big.width, big.height) <= 3000);
  assert.ok(Math.abs(big.width / big.height - 1) < 0.01);
});

test("the answer decodes as little-endian float32, row by row; a short answer is no answer", () => {
  const buf = new ArrayBuffer(4 * 6 + 1);
  const v = new DataView(buf);
  [220.5, 219.25, 1, 2, 3, -3.4e38].forEach((x, i) => v.setFloat32(i * 4, x, true));
  const dem = decodeBip(buf, 3, 2)!;
  assert.equal(dem[0], 220.5);
  assert.equal(dem[1], 219.25);
  assert.equal(decodeBip(new ArrayBuffer(10), 3, 2), null);
  assert.equal(mostlyMissing(dem), false);
  assert.equal(mostlyMissing(new Float32Array([-3.4e38, -3.4e38, 5])), true);
});

test("a crowned lane through flat ground renders light, its ditches dark, and missing ground reads flat", () => {
  // 60 x 60 px at 0.5 m: flat at 100 m, a lane down the middle 0.15 m high, ditches either side 0.15 m low.
  const W = 60, H = 60, dem = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dem[y * W + x] = 100 + (x >= 28 && x <= 31 ? 0.15 : x === 26 || x === 33 ? -0.15 : 0);
  const g = lidarRelief(dem, W, H, [0.5, 0.5]);
  const at = (x: number) => g[30 * W + x];
  assert.ok(at(29) > at(10) + 20, `lane ${at(29)} vs ground ${at(10)}`);
  assert.ok(at(26) < at(10) - 20, `ditch ${at(26)} vs ground ${at(10)}`);
  // A hole of no-data in flat ground: the same grey as the ground around it.
  const holed = new Float32Array(W * H).fill(100);
  for (let i = 0; i < 50; i++) holed[i] = -3.4e38;
  const h = lidarRelief(holed, W, H, [0.5, 0.5]);
  assert.ok(Math.abs(h[10] - h[30 * W + 30]) <= 2);
});

test("Oregon tries its own lidar first, then 3DEP; elsewhere only 3DEP", () => {
  assert.deepEqual(lidarSourcesFor([-121.774, 45.113, -121.768, 45.116]).map((s) => s.key), ["dogami", "3dep"]);
  assert.deepEqual(lidarSourcesFor(box).map((s) => s.key), ["3dep"]);
  // Just across the borders: Charbonneau Park, Washington; Kalama, Washington; Weiser, Idaho.
  for (const [lon, lat] of [[-118.85, 46.25], [-122.84, 46.0], [-116.97, 44.25]]) assert.equal(inOregon(lon, lat), false, `${lon} ${lat}`);
  // And inside: Timothy Lake, the coast at Cape Blanco, Ontario by the Snake, Pendleton.
  for (const [lon, lat] of [[-121.77, 45.11], [-124.5, 42.84], [-117.0, 44.03], [-118.79, 45.67]]) assert.equal(inOregon(lon, lat), true, `${lon} ${lat}`);
  for (const s of Object.values(LIDAR_SOURCES)) assert.match(s.credit, /public domain/);
});
