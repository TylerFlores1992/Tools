// A tracing aid: the USDA aerial photo (NAIP, public domain) of a built map, or of part of it,
// with a labelled grid in the map's own metres, the map's roads (yellow; traced ones cyan) and its
// sites (magenta), as a PNG. A session reads the PNG to judge a map and to trace what's missing in
// map metres (then trace-from-grid.mjs writes the trace file); a person can use the review page's
// tracing tool instead.
//
//   node studio/campground-maps/aerial-grid.mjs <map.json> <out.png> [x0 y0 x1 y1] [step=20] [width=1600]
//
// With no box it shows the whole frame. Zoom in with a box and a 5 m step to trace (the photo is
// 0.6-1 m a pixel). Coordinates on the grid are the map's local metres, x east and y south.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [file, out, ...rest] = process.argv.slice(2);
if (!file || !out) { console.error("usage: aerial-grid.mjs <map.json> <out.png> [x0 y0 x1 y1] [step] [width]"); process.exit(1); }
const map = JSON.parse(readFileSync(file, "utf8"));
if (!map.bbox) { console.error(`${file}: no bbox (rebuild it)`); process.exit(1); }
const f = map.frame, [w, s, e, n] = map.bbox;
const [x0, y0, x1, y1] = rest.length >= 4 ? rest.slice(0, 4).map(Number) : [f.x, f.y, f.x + f.w, f.y + f.h];
const step = Number(rest[4] ?? 20), W = Number(rest[5] ?? 1600);
// The map's metres are linear in longitude and latitude, so the box converts by interpolation.
const lon = (x) => w + ((x - f.x) / f.w) * (e - w), lat = (y) => n - ((y - f.y) / f.h) * (n - s);
const H = Math.round((W * (y1 - y0)) / (x1 - x0));
const q = new URLSearchParams({ bbox: [lon(x0), lat(y1), lon(x1), lat(y0)].join(","), bboxSR: "4326", imageSR: "3857", size: `${W},${H}`, format: "jpg", f: "image" });
let photo;
for (let i = 0; i < 4 && !photo; i++) {
  const res = await fetch(`https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage?${q}`, { signal: AbortSignal.timeout(90000) }).catch(() => null);
  if (res?.ok && /image/.test(res.headers.get("content-type") ?? "")) photo = Buffer.from(await res.arrayBuffer());
}
if (!photo) { console.error("the aerial photo didn't load (USGS may be busy; try again)"); process.exit(1); }
const k = W / (x1 - x0);
const px = (x, y) => [((x - x0) * k).toFixed(1), ((y - y0) * k).toFixed(1)];
const path = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, a, b) => px(Number(a), Number(b)).join(" "));
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const label = (x, y, t) => `<text x="${x}" y="${y}" font-size="11" font-family="sans-serif" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke">${t}</text>`;
let grid = "";
for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const [a] = px(x, 0); grid += `<line x1="${a}" y1="0" x2="${a}" y2="${H}" stroke="#fff" stroke-opacity="${x % (step * 5) === 0 ? 0.55 : 0.28}"/>${label(Number(a) + 2, 12, x)}`; }
for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const [, b] = px(0, y); grid += `<line x1="0" y1="${b}" x2="${W}" y2="${b}" stroke="#fff" stroke-opacity="${y % (step * 5) === 0 ? 0.55 : 0.28}"/>${label(2, Number(b) - 2, y)}`; }
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${grid}
${map.roads.map((r) => `<path d="${path(r.d)}" fill="none" stroke="${r.traced ? "#00e5ff" : "#ffd400"}" stroke-width="${r.traced ? 2.5 : 2}" stroke-opacity="0.9"/>`).join("")}
${map.sites.filter((x) => x.at).map((x) => { const [a, b] = px(...x.at); return `<circle cx="${a}" cy="${b}" r="3.5" fill="#ff2fd0" stroke="#fff" stroke-width="1.2"/><text x="${Number(a) + 5}" y="${Number(b) + 4}" font-family="sans-serif" font-size="10" font-weight="700" fill="#fff" stroke="#000" stroke-width="2.2" paint-order="stroke">${esc(x.name)}</text>`; }).join("")}
<rect x="0" y="${H - 20}" width="${W}" height="20" fill="#000" fill-opacity="0.6"/><text x="6" y="${H - 6}" font-family="sans-serif" font-size="12" fill="#fff">${esc(map.name)} · grid ${step} m · x ${x0}..${x1}, y ${y0}..${y1}</text></svg>`;
writeFileSync(out, await sharp(photo).resize(W, H, { fit: "fill" }).composite([{ input: Buffer.from(svg) }]).png().toBuffer());
console.log(out, W, H);
