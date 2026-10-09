// Lidar relief: the ground under the trees, from USGS 3DEP lidar elevation (public domain), for
// judging and tracing a map where the aerial photo shows only canopy. Campground lanes are crowned
// and ditched, and pads are levelled, so they stand out in the ground's fine relief (elevation
// minus a smoothed copy of itself) even where no photo can see them (docs/design/campground-maps.md,
// "Fix after": Gulpha Gorge's middle lanes, Deep Creek's pull-in pads).
//
// Pure, so it is tested (lidar.test.mts) and shared: the review page renders it in the browser
// (3DEP answers any origin), and studio/campground-maps/aerial-grid.mjs and aerial-check.mjs
// render it in Node (LIDAR=1).

type Bbox = [number, number, number, number];

export type LidarSource = { key: "3dep" | "dogami"; service: string; host: string; credit: string; short: string };

/** The sources, by key. Both answer any origin, so the review page renders in the browser. */
export const LIDAR_SOURCES: Record<LidarSource["key"], LidarSource> = {
  "3dep": {
    key: "3dep",
    service: "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage",
    host: "USGS’s elevation service",
    /** What a trace drawn over it records as its `photo`, and the credit. */
    credit: "USGS 3D Elevation Program lidar (public domain)",
    short: "Lidar relief: USGS 3DEP (public domain)",
  },
  // Oregon's own lidar fills the state where 3DEP has only a coarse 2010s model (Timothy Lake).
  // "All DOGAMI lidar data is in the public domain, please reference DOGAMI as the data source."
  // (DOGAMI's lidar program record on data.gov, 2020.) Outside its lidar the mosaic has no data,
  // so a render falls back to 3DEP (lidarSourcesFor).
  dogami: {
    key: "dogami",
    service: "https://gis.dogami.oregon.gov/arcgis/rest/services/lidar/DIGITAL_TERRAIN_MODEL_MOSAIC/ImageServer/exportImage",
    host: "Oregon DOGAMI’s lidar service",
    credit: "Oregon Department of Geology and Mineral Industries (DOGAMI) lidar (public domain)",
    short: "Lidar relief: Oregon DOGAMI (public domain)",
  },
};
/** The default source, for credits and the 3DEP-only callers. */
export const LIDAR = LIDAR_SOURCES["3dep"];

/**
 * Oregon's outline, to a few kilometres: the coast, California and Nevada at 42°N, Idaho along the
 * Snake, Washington along 46°N and then the Columbia. A box was too wide: it took in Charbonneau
 * Park, Washington (46.25°N), and drew it from Oregon's lidar (pilot, 2026-10-09).
 */
const OREGON: [number, number][] = [
  [-124.8, 42.0], [-117.03, 42.0], [-117.03, 43.68], [-116.93, 44.1], [-117.24, 44.39], [-116.46, 45.6],
  [-116.92, 45.99], [-119.0, 46.0], [-119.6, 45.92], [-120.5, 45.7], [-121.2, 45.61], [-121.9, 45.66],
  [-122.25, 45.55], [-122.77, 45.65], [-122.78, 45.87], [-122.95, 46.1], [-123.4, 46.2], [-123.9, 46.24],
  [-124.8, 46.3],
];

/** Inside Oregon's outline (its lidar mosaic answers no data a little past its edges, which falls back). */
export function inOregon(lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = OREGON.length - 1; i < OREGON.length; j = i++) {
    const [xi, yi] = OREGON[i], [xj, yj] = OREGON[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The sources to try for a box, best first: Oregon's own lidar there, then 3DEP. */
export function lidarSourcesFor(bbox: Bbox): LidarSource[] {
  const [w, s, e, n] = bbox;
  return inOregon((w + e) / 2, (s + n) / 2) ? [LIDAR_SOURCES.dogami, LIDAR_SOURCES["3dep"]] : [LIDAR_SOURCES["3dep"]];
}

/** Most of the box has no elevation (outside a source's lidar): try the next source. */
export function mostlyMissing(dem: Float32Array): boolean {
  let bad = 0;
  for (const v of dem) if (!(v > -1000 && v < 10000)) bad++;
  return bad > dem.length / 2;
}

/** The most pixels a side may ask for (the service's own limit is higher; this keeps a render quick). */
export const LIDAR_MAX_PX = 3000;

/** Ground metres per pixel for a bbox at a pixel size (x, y). The map's metres are linear in degrees. */
export function metresPerPx(bbox: Bbox, size: { width: number; height: number }): [number, number] {
  const [w, s, e, n] = bbox, lat = ((s + n) / 2) * (Math.PI / 180);
  return [((e - w) * 111320 * Math.cos(lat)) / size.width, ((n - s) * 110540) / size.height];
}

/**
 * The pixel size for a bbox at about `mPerPx` metres a pixel across (1 m lidar: ask for 0.5-1 m).
 * The pixels are square in DEGREES, as the services draw them: asked for any other shape, they
 * widen the box's latitude span to keep them square and the answer covers more ground than the box
 * (26% more at 38°N, measured against 3DEP 2026-10-09), so every north-south position drawn over it
 * would be off. So a pixel is `mPerPx` north-south and a little finer east-west (metresPerPx says
 * how much).
 */
export function lidarSize(bbox: Bbox, mPerPx = 0.6): { width: number; height: number } {
  const [w, s, e, n] = bbox;
  const [, my] = metresPerPx(bbox, { width: 1, height: 1 });
  const tall = Math.max(8, Math.round(my / mPerPx));
  const k = Math.min(1, LIDAR_MAX_PX / Math.max(tall, (tall * (e - w)) / (n - s)));
  const height = Math.max(8, Math.round(tall * k));
  return { width: Math.max(8, Math.round((height * (e - w)) / (n - s))), height };
}

/** The bare-earth elevation of `bbox` as raw float32 (format bip), in degrees, so its pixels line up
    with the map's metres. */
export function lidarUrl(bbox: Bbox, size: { width: number; height: number }, src: LidarSource = LIDAR): string {
  const q = new URLSearchParams({ bbox: bbox.join(","), bboxSR: "4326", imageSR: "4326", size: `${size.width},${size.height}`, format: "bip", pixelType: "F32", renderingRule: JSON.stringify({ rasterFunction: "None" }), f: "image" });
  return `${src.service}?${q}`;
}

/** The elevations (metres, row by row) from the service's bip answer: little-endian float32, then a
    validity mask. Null when the answer is too short (an error page, not elevation). */
export function decodeBip(buf: ArrayBuffer, width: number, height: number): Float32Array | null {
  const n = width * height;
  if (buf.byteLength < n * 4) return null;
  const view = new DataView(buf), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

/** A box blur of radius kx by ky (pixels) by an integral image, edges extended. */
function boxBlur(a: Float64Array, w: number, h: number, kx: number, ky: number): Float64Array {
  const W = w + 1, sum = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += a[y * w + x]; sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + row; }
  }
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - ky), y1 = Math.min(h, y + ky + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - kx), x1 = Math.min(w, x + kx + 1);
      out[y * w + x] = (sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0]) / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

/**
 * The fine relief as grey levels (0-255, row by row): the ground minus a `windowM` smoothed copy,
 * clipped to ±`clipM` (a road's crown is a few centimetres to decimetres), blended with a
 * low-sun hillshade from four directions. Raised ground is light, ditches dark. Missing elevations
 * (the service's no-data, below -1000) take the mean, so they read flat.
 */
export function lidarRelief(dem: Float32Array, width: number, height: number, mPerPx: [number, number], { windowM = 8, clipM = 0.3 } = {}): Uint8ClampedArray {
  const n = width * height;
  let total = 0, count = 0;
  for (let i = 0; i < n; i++) if (dem[i] > -1000) { total += dem[i]; count++; }
  const mean = count ? total / count : 0;
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) z[i] = dem[i] > -1000 ? dem[i] : mean;
  // The window is the same ground distance both ways, though a pixel isn't (lidarSize).
  const kx = Math.max(1, Math.round(windowM / 2 / mPerPx[0])), ky = Math.max(1, Math.round(windowM / 2 / mPerPx[1]));
  const smooth = boxBlur(boxBlur(z, width, height, kx, ky), width, height, kx, ky);
  const out = new Uint8ClampedArray(n);
  const alt = (35 * Math.PI) / 180, dirs = [315, 45, 135, 225].map((d) => (d * Math.PI) / 180);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const zx = (z[y * width + Math.min(width - 1, x + 1)] - z[y * width + Math.max(0, x - 1)]) / ((Math.min(width - 1, x + 1) - Math.max(0, x - 1)) * mPerPx[0] || 1);
      const zy = (z[Math.min(height - 1, y + 1) * width + x] - z[Math.max(0, y - 1) * width + x]) / ((Math.min(height - 1, y + 1) - Math.max(0, y - 1)) * mPerPx[1] || 1);
      // Three times the real slope, so the shading shows banks and ditches.
      const gx = zx * 3, gy = zy * 3, slope = Math.atan(Math.hypot(gx, gy)), aspect = Math.atan2(-gx, gy);
      let hs = 0;
      for (const a of dirs) hs += Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(a - aspect);
      hs = Math.min(1, Math.max(0, hs / 4));
      const local = (Math.min(clipM, Math.max(-clipM, z[i] - smooth[i])) + clipM) / (2 * clipM);
      out[i] = Math.round((0.55 * local + 0.45 * hs) * 255);
    }
  }
  return out;
}
