// A reviewer's check: each built map's sites and roads over the USDA aerial photo (NAIP, public
// domain, via USGS The National Map) of the same frame, as a PNG. Not part of any map: it is how
// a person (or a session) judges whether the points sit on real pads and the roads on real roads.
//
//   node studio/campground-maps/aerial-check.mjs <out-dir> <map.json>…
//
// The photo is asked for in Web Mercator for the map's own bbox, with the frame's proportions,
// so it lines up with the map's local metres (the two projections differ by far less than a
// pixel across a campground).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

const NAIP = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage";
const [outDir, ...files] = process.argv.slice(2);
if (!outDir || !files.length) { console.error("usage: aerial-check.mjs <out-dir> <map.json>…"); process.exit(1); }
mkdirSync(outDir, { recursive: true });

// USGS serves at most 4,000 px a side and answers a bigger ask with a JSON error under an image
// header (the same limit as src/lab/camphawk/round2/maps/naip.ts, which the review page uses).
export function naipUrl(bbox, frame, width = 1000) {
  const tall = (width * frame.h) / frame.w, scale = Math.min(1, 4000 / Math.max(width, tall));
  width = Math.floor(width * scale);
  const height = Math.floor(tall * scale);
  const q = new URLSearchParams({ bbox: bbox.join(","), bboxSR: "4326", imageSR: "3857", size: `${width},${height}`, format: "jpg", f: "image" });
  return { url: `${NAIP}?${q}`, width, height };
}

/** A listing shown as areas (build.mjs viewOf): each area's own map frame, dashed, with its number
    and name, so a first look can judge the split over the photo (does each frame hold one cluster?). */
export function areaFrames(map, px, s, esc) {
  if (map.split?.kind !== "areas") return "";
  return map.split.areas.map((a, i) => {
    const [x, y] = px([a.frame.x, a.frame.y]);
    return `<rect x="${x}" y="${y}" width="${(a.frame.w * s).toFixed(1)}" height="${(a.frame.h * s).toFixed(1)}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="10 6"/>`
      + `<text x="${Number(x) + 6}" y="${Math.max(Number(y), 26) + 18}" font-family="sans-serif" font-size="15" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${i + 1}. ${esc(a.name)} (${a.sites.length})</text>`;
  }).join("");
}

/** A first-come campground (map.firstCome): OpenStreetMap's outline, which the first-come map draws
    as the campground, in white with a dark edge, so a first look can judge it over the photo. */
export function firstComeOutline(map, path) {
  if (!map.firstCome || !map.evidence?.outline) return "";
  const d = path(map.evidence.outline);
  return `<path d="${d}" fill="none" stroke="#000" stroke-width="5" stroke-opacity="0.6"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="8 5"/>`;
}

for (const file of files) {
  const map = JSON.parse(readFileSync(file, "utf8"));
  if (!map.bbox) { console.log(`${file}: no bbox (rebuild it)`); continue; }
  const { url, width: W, height: H } = naipUrl(map.bbox, map.frame);
  // USGS sometimes answers 200 "image/jpeg" with a body that isn't one (2026-10-08, wave 1): a
  // photo counts only once it decodes. A map with no photo is reported and the run carries on.
  let photo;
  for (let i = 0; i < 4 && !photo; i++) {
    if (i) await new Promise((r) => setTimeout(r, 3000 * i));
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) }).catch(() => null);
    if (!res?.ok || !/image/.test(res.headers.get("content-type") ?? "")) continue;
    const body = Buffer.from(await res.arrayBuffer());
    if (await sharp(body).metadata().then(() => true, () => false)) photo = body;
  }
  if (!photo) { console.log(`${file}: no aerial photo (USGS didn't send one that decodes; run it again)`); continue; }
  const f = map.frame, s = W / f.w;
  const px = ([x, y]) => [((x - f.x) * s).toFixed(1), ((y - f.y) * s).toFixed(1)];
  const path = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => px([Number(x), Number(y)]).join(" "));
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${map.roads.map((r) => `<path d="${path(r.d)}" fill="none" stroke="#ffd400" stroke-width="2" stroke-opacity="0.85"/>`).join("")}
    ${map.sites.filter((x) => x.at).map((x) => { const [a, b] = px(x.at); return `<circle cx="${a}" cy="${b}" r="4" fill="#ff2fd0" stroke="#fff" stroke-width="1.5"/><text x="${Number(a) + 6}" y="${Number(b) + 4}" font-family="sans-serif" font-size="11" font-weight="700" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke">${esc(x.name)}</text>`; }).join("")}
    ${map.pois.map((p) => { const [a, b] = px(p.at); return `<rect x="${Number(a) - 5}" y="${Number(b) - 5}" width="10" height="10" fill="#00e5ff" stroke="#000"/>`; }).join("")}
    ${areaFrames(map, px, s, esc)}
    ${firstComeOutline(map, path)}
    <rect x="0" y="0" width="${W}" height="26" fill="#000" fill-opacity="0.6"/>
    <text x="8" y="18" font-family="sans-serif" font-size="14" fill="#fff">${esc(map.name)} · ${esc(map.facilityId)} · ${esc(map.qa?.verdict ?? "")} · roads ${esc(map.sources?.roads ?? "")} · ${Math.round(f.w)}×${Math.round(f.h)} m</text>
  </svg>`;
  const out = join(outDir, basename(file).replace(/\.json$/, ".png"));
  writeFileSync(out, await sharp(photo).resize(W, H, { fit: "fill" }).composite([{ input: Buffer.from(svg) }]).png().toBuffer());
  console.log(out);
}
