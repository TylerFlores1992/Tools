import { test } from "node:test";
import assert from "node:assert/strict";
import { NAIP_MAX_PX, naipSize, naipUrl } from "./naip.ts";

const sizeIn = (url: string) => new URL(url).searchParams.get("size")!.split(",").map(Number);

test("an ordinary frame is asked for at the width given, in its own shape", () => {
  assert.deepEqual(naipSize({ w: 500, h: 400 }, 1400), { width: 1400, height: 1120 });
});

test("a tall frame stays inside USGS's 4,000 px limit (Diamond Lake, 536 × 3,495 m)", () => {
  // At 1,400 px wide this frame is 9,135 px tall: USGS answered with a JSON error and the photo never loaded.
  const s = naipSize({ w: 535.6, h: 3494.6 }, 1400);
  assert.ok(s.height <= NAIP_MAX_PX && s.width <= NAIP_MAX_PX, JSON.stringify(s));
  assert.ok(s.height >= NAIP_MAX_PX - 1);
  assert.ok(Math.abs(s.width / s.height - 535.6 / 3494.6) < 0.001, "the shape is kept");
});

test("a wide ask is scaled down too (the tracing tool asks for up to 4,000 px wide)", () => {
  const s = naipSize({ w: 2000, h: 1000 }, 6000);
  assert.deepEqual(s, { width: 4000, height: 2000 });
});

test("the URL carries the scaled size", () => {
  const [w, h] = sizeIn(naipUrl([-122.14, 43.14, -122.13, 43.17], { w: 535.6, h: 3494.6 }));
  assert.ok(w <= NAIP_MAX_PX && h <= NAIP_MAX_PX, `${w}×${h}`);
  assert.equal(NAIP_MAX_PX, 4000, "USGS's maxImageWidth/maxImageHeight, measured 2026-10-08");
});
