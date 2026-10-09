// The lidar relief of a box as a PNG (src/lab/camphawk/round2/maps/lidar.ts renders it), for
// aerial-grid.mjs and aerial-check.mjs when run with LIDAR=1: the ground under the trees, where the
// aerial photo shows only canopy. USGS 3DEP elevation, public domain. Network: NODE_USE_ENV_PROXY=1.
import sharp from "sharp";
import { decodeBip, lidarRelief, lidarSize, lidarSourcesFor, lidarUrl, metresPerPx, mostlyMissing } from "../../src/lab/camphawk/round2/maps/lidar.ts";

/** A grey PNG of `bbox` ([w, s, e, n] degrees) at about `mPerPx`, with the source it came from
    (lidar.ts lidarSourcesFor: Oregon's own lidar there, else 3DEP); throws when none answers. */
export async function lidarPng(bbox, mPerPx = 0.6) {
  const size = lidarSize(bbox, mPerPx);
  for (const src of lidarSourcesFor(bbox)) {
    let dem = null;
    for (let i = 0; i < 4 && !dem; i++) {
      const res = await fetch(lidarUrl(bbox, size, src), { signal: AbortSignal.timeout(90000) }).catch(() => null);
      if (res?.ok) dem = decodeBip(await res.arrayBuffer(), size.width, size.height);
    }
    if (!dem || mostlyMissing(dem)) continue;
    const grey = lidarRelief(dem, size.width, size.height, metresPerPx(bbox, size));
    return { png: await sharp(Buffer.from(grey.buffer), { raw: { width: size.width, height: size.height, channels: 1 } }).png().toBuffer(), size, source: src };
  }
  throw new Error("no lidar service answered with elevations for this box (try again)");
}
