import { test } from "node:test";
import assert from "node:assert/strict";
import { AERIAL, PICKS, aerialSource, aerialUrl, exportUrl, photoSize, sizeFor, type Bbox } from "./aerial.ts";

// Real frames (RIDB facility ids and bboxes from public/private/camphawk/maps/).
const UPPER_PINES: Bbox = [-119.5683, 37.7333, -119.5596, 37.7389];
const RUSSIAN_RIVER: Bbox = [-149.981304, 60.478716, -149.96781, 60.486344];
const HALEAKALA: Bbox = [-156.219384, 20.717036, -156.141826, 20.740206];
const MARION_CREEK: Bbox = [-150.160416, 67.315365, -150.152928, 67.319814];
const ATTU: Bbox = [173.18, 52.84, 173.2, 52.85];
const host = (u: string | null) => (u ? new URL(u).hostname : null);

test("the lower 48 stay on USDA NAIP via USGS", () => {
  assert.equal(aerialSource({ facilityId: "232447", bbox: UPPER_PINES })?.key, "naip");
  assert.equal(host(aerialUrl({ bbox: UPPER_PINES }, { w: 500, h: 400 })), "imagery.nationalmap.gov");
});

test("Hawaii gets NAIP 2021 Hawaii (USGS's NAIP answers blank there)", () => {
  assert.equal(aerialSource({ facilityId: "10119505", bbox: HALEAKALA })?.key, "naip-hawaii");
});

test("Alaska gets the Forest Service's Alaska Region photos, four-band by default", () => {
  assert.equal(aerialSource({ facilityId: "232213", bbox: RUSSIAN_RIVER })?.key, "usfs-r10");
  assert.equal(aerialSource({ bbox: ATTU })?.key, "usfs-r10", "the Aleutians past 180°");
  const u = new URL(aerialUrl({ bbox: RUSSIAN_RIVER }, { w: 742, h: 850 })!);
  assert.equal(u.hostname, "imagery.geoplatform.gov");
  assert.equal(u.searchParams.get("bandIds"), "0,1,2", "red, green, blue of a four-band service");
});

test("a measured pick wins over the place: the older service, or no photo at all", () => {
  assert.equal(aerialSource({ facilityId: "233088", bbox: RUSSIAN_RIVER })?.key, "usfs-r10-rgb");
  assert.equal(aerialSource({ facilityId: "10191011", bbox: MARION_CREEK }), null);
  assert.equal(aerialUrl({ facilityId: "10191011", bbox: MARION_CREEK }, { w: 322, h: 496 }), null);
  // Without the pick, Marion Creek (67° N, the Dalton Highway) would be asked of a service that has nothing there.
  assert.equal(aerialSource({ bbox: MARION_CREEK })?.key, "usfs-r10");
});

test("every pick names a source that exists", () => {
  for (const [id, k] of Object.entries(PICKS)) assert.ok(k === "none" || k in AERIAL, `${id}: ${k}`);
});

test("every source is a federal public-domain one, and says so in its credit", () => {
  for (const s of Object.values(AERIAL)) {
    assert.match(new URL(s.service).hostname, /^imagery\.(nationalmap|geoplatform)\.gov$/, s.key);
    assert.match(s.credit, /public domain/, s.key);
    assert.match(s.short, /public domain/, s.key);
    assert.doesNotMatch(s.service, /USGSImageryOnly|arcgisonline|google|bing|virtualearth/i, `${s.key}: not a viewing-only basemap`);
  }
});

test("the size limit and bands carry into every source's URL", () => {
  const size = photoSize({ w: 535.6, h: 3494.6 }, 1400);
  for (const s of Object.values(AERIAL)) {
    const u = new URL(exportUrl(s, RUSSIAN_RIVER, size));
    const [w, h] = u.searchParams.get("size")!.split(",").map(Number);
    assert.ok(w <= 4000 && h <= 4000, `${s.key} ${w}×${h}`);
    assert.equal(u.searchParams.get("bandIds"), s.bands ?? null, s.key);
  }
});

test("a fixed-scale source is asked at its own scale, whatever width the caller wants", () => {
  // Spencer Glacier's 115 × 174 m frame: the 2010 photo answers blank at 1,400 px and draws at 0.6 m a pixel.
  const SPENCER: Bbox = [-149.2235, 60.6076, -149.2214, 60.6092];
  assert.equal(aerialSource({ facilityId: "10300372", bbox: SPENCER })?.key, "usfs-r10-0.6m");
  const [w, h] = new URL(aerialUrl({ facilityId: "10300372", bbox: SPENCER }, { w: 115, h: 174 }, 1400)!).searchParams.get("size")!.split(",").map(Number);
  assert.equal(w, Math.round(115 / 0.6));
  assert.equal(h, Math.floor((w * 174) / 115));
  assert.deepEqual(sizeFor(AERIAL["usfs-r10"], { w: 115, h: 174 }, 1400).width, 1400, "the others take the width asked");
});
