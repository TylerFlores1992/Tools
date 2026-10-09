// The ground under the trees from USGS 3DEP lidar POINT CLOUDS (pointcloud/ground.py makes the PNGs),
// for aerial-grid.mjs and aerial-check.mjs run with GROUND=intensity or GROUND=relief, and the credit
// trace-from-grid.mjs records for a trace drawn over it. USGS's data, public domain.
//
// Each map's PNGs cover exactly its frame (ground.py), so a box in the map's metres is a pixel crop.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/** What a trace drawn over these layers records in its `photo` (build.mjs tracedOver reads it). */
export const GROUND_CREDIT = "USGS 3D Elevation Program lidar point cloud (public domain)";

/** The layers, and what the picture says it is. */
export const GROUND_LAYERS = {
  intensity: "LIDAR INTENSITY (USGS 3DEP points)",
  relief: "LIDAR GROUND RELIEF (USGS 3DEP points)",
};

export const GROUND_DIR = join(import.meta.dirname, ".cache", "pointcloud");

/** GROUND's value: null when unset, the layer when known; throws on anything else. */
export function groundLayer(value) {
  if (value === undefined || value === "") return null;
  if (!Object.hasOwn(GROUND_LAYERS, value)) throw new Error(`GROUND=${value}: use GROUND=${Object.keys(GROUND_LAYERS).join(" or GROUND=")}`);
  return value;
}

/** The command that makes a map's ground PNGs. */
export function groundCommand(mapFile, force = false) {
  return `python3 -I studio/campground-maps/pointcloud/ground.py ${mapFile}${force ? " --force" : ""}`;
}

/** The label: the layer, and the survey's year when ground.py recorded it. */
export function groundLabel(layer, meta) {
  const year = (meta?.survey?.end ?? meta?.survey?.published ?? "").slice(0, 4);
  return year ? GROUND_LAYERS[layer].replace(/\)$/, `, ${meta.survey.end ? "flown" : "published"} ${year})`) : GROUND_LAYERS[layer];
}

/** A map's ground PNG and its meta.json, or `problem` when there is none or it was made for another
    frame (the map was rebuilt since: the PNG would sit in the wrong place). */
export function groundFile(map, layer, dir = GROUND_DIR) {
  const base = join(dir, `ridb-${map.facilityId}`);
  const png = join(base, `${layer}.png`);
  if (!existsSync(png)) return { png, problem: `no ${layer}.png for ridb-${map.facilityId} (${base})`, stale: false };
  let meta = null;
  try { meta = JSON.parse(readFileSync(join(base, "meta.json"), "utf8")); } catch { /* checked below */ }
  if (!meta) return { png, problem: `ridb-${map.facilityId}'s ground has no meta.json (${base})`, stale: true };
  if (!sameFrame(meta, map)) return { png, problem: `ridb-${map.facilityId}'s ground was made for another frame (the map was rebuilt since)`, stale: true };
  return { png, meta, problem: null, stale: false };
}

/** Were the PNGs made for this map's bbox and frame? */
export function sameFrame(meta, map) {
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  return Array.isArray(meta.bbox) && meta.bbox.length === 4 && meta.bbox.every((v, i) => near(v, map.bbox[i]))
    && ["x", "y", "w", "h"].every((k) => near(meta.frame?.[k], map.frame[k]));
}

/** The pixel arithmetic to show `box` ([x0, y0, x1, y1], map metres) of a PNG covering exactly
    `frame` (img: its size), drawn at `out` (size): which pixels to take, the size to scale them to,
    and where they land, clipped to the output (the box may reach past the frame; the rest stays
    black). Null when the box misses the frame. */
export function groundCrop(frame, img, box, out) {
  const [bx0, by0, bx1, by1] = box;
  const sx = img.width / frame.w, sy = img.height / frame.h;
  const cx0 = Math.max(bx0, frame.x), cy0 = Math.max(by0, frame.y);
  const cx1 = Math.min(bx1, frame.x + frame.w), cy1 = Math.min(by1, frame.y + frame.h);
  if (cx1 <= cx0 || cy1 <= cy0) return null;
  // Whole pixels that hold the part of the box inside the frame.
  const left = Math.max(0, Math.floor((cx0 - frame.x) * sx)), top = Math.max(0, Math.floor((cy0 - frame.y) * sy));
  const right = Math.min(img.width, Math.ceil((cx1 - frame.x) * sx)), bottom = Math.min(img.height, Math.ceil((cy1 - frame.y) * sy));
  // Those pixels' edges in metres, then in output pixels.
  const kx = out.width / (bx1 - bx0), ky = out.height / (by1 - by0);
  const ox0 = (frame.x + left / sx - bx0) * kx, oy0 = (frame.y + top / sy - by0) * ky;
  const ox1 = (frame.x + right / sx - bx0) * kx, oy1 = (frame.y + bottom / sy - by0) * ky;
  const resize = { width: Math.max(1, Math.round(ox1 - ox0)), height: Math.max(1, Math.round(oy1 - oy0)) };
  const at = { left: Math.round(ox0), top: Math.round(oy0) };
  // Clip what lands outside the output.
  const clipL = Math.max(0, -at.left), clipT = Math.max(0, -at.top);
  const clipR = Math.max(0, at.left + resize.width - out.width), clipB = Math.max(0, at.top + resize.height - out.height);
  const clip = { left: clipL, top: clipT, width: resize.width - clipL - clipR, height: resize.height - clipT - clipB };
  if (clip.width <= 0 || clip.height <= 0) return null;
  return { extract: { left, top, width: right - left, height: bottom - top }, resize, clip, at: { left: at.left + clipL, top: at.top + clipT } };
}

/** `box` of the map's ground PNG as an `out`-sized PNG buffer (black past the frame). */
export async function groundImage(png, frame, box, out) {
  const meta = await sharp(png).metadata();
  const c = groundCrop(frame, { width: meta.width, height: meta.height }, box, out);
  const canvas = sharp({ create: { width: out.width, height: out.height, channels: 3, background: "#000" } });
  if (!c) return canvas.png().toBuffer();
  const piece = await sharp(png).extract(c.extract).resize(c.resize.width, c.resize.height, { fit: "fill", kernel: "lanczos3" }).extract(c.clip).png().toBuffer();
  return canvas.composite([{ input: piece, left: c.at.left, top: c.at.top }]).png().toBuffer();
}
