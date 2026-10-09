// A tracing aid: the aerial photo (public domain; src/lab/camphawk/round2/maps/aerial.ts picks it) of a built map, or of part of it,
// with a labelled grid in the map's own metres, the map's roads (yellow; traced ones cyan) and its
// sites (magenta), as a PNG. A session reads the PNG to judge a map and to trace what's missing in
// map metres (then trace-from-grid.mjs writes the trace file); a person can use the review page's
// tracing tool instead.
//
//   node studio/campground-maps/aerial-grid.mjs <map.json> <out.png> [x0 y0 x1 y1] [step=20] [width=1600]
//
// With LIDAR=1 the ground is the lidar relief (USGS 3DEP, public domain; lidar.mjs) instead of the
// photo: lanes and pads under full canopy show as light crowned lines with dark ditches.
//
// With no box it shows the whole frame. Zoom in with a box and a 5 m step to trace (the photo is
// 0.6-1 m a pixel). Coordinates on the grid are the map's local metres, x east and y south.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { AERIAL, aerialSource, exportUrl, sizeFor } from "../../src/lab/camphawk/round2/maps/aerial.ts";
import { lidarPng } from "./lidar.mjs";

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
const lidar = !!process.env.LIDAR;
const src = lidar ? { key: "lidar" } : process.env.AERIAL ? AERIAL[process.env.AERIAL] : aerialSource(map); // AERIAL=<key> to compare
if (!src) { console.error(`${file}: no public-domain aerial photo covers this map (aerial.ts); try LIDAR=1`); process.exit(1); }
let photo;
let lidarFrom = "";
if (lidar) { const l = await lidarPng([lon(x0), lat(y1), lon(x1), lat(y0)], Math.max(0.5, (x1 - x0) / W)); photo = l.png; lidarFrom = l.source.key; }
else {
  // A fixed-scale source (aerial.ts) is asked at its own scale and stretched to the grid's width.
  const url = exportUrl(src, [lon(x0), lat(y1), lon(x1), lat(y0)], sizeFor(src, { w: x1 - x0, h: y1 - y0 }, W));
  for (let i = 0; i < 4 && !photo; i++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90000) }).catch(() => null);
    if (res?.ok && /image/.test(res.headers.get("content-type") ?? "")) photo = Buffer.from(await res.arrayBuffer());
  }
}
if (!photo) { console.error(`the aerial photo didn't load (${src.key} may be busy; try again)`); process.exit(1); }
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
${map.sites.filter((x) => x.at && x.movedFrom).map((x) => { const [a, b] = px(...x.movedFrom), [c, d] = px(...x.at); return `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#fff" stroke-width="2" stroke-dasharray="5 4"/><circle cx="${a}" cy="${b}" r="4" fill="none" stroke="#ff2fd0" stroke-width="1.5" stroke-dasharray="2 2"/>`; }).join("")}
${map.sites.filter((x) => x.at).map((x) => { const [a, b] = px(...x.at); return `<circle cx="${a}" cy="${b}" r="3.5" fill="#ff2fd0" stroke="#fff" stroke-width="1.2"/><text x="${Number(a) + 5}" y="${Number(b) + 4}" font-family="sans-serif" font-size="10" font-weight="700" fill="#fff" stroke="#000" stroke-width="2.2" paint-order="stroke">${esc(x.name)}</text>`; }).join("")}
<rect x="0" y="${H - 20}" width="${W}" height="20" fill="#000" fill-opacity="0.6"/><text x="6" y="${H - 6}" font-family="sans-serif" font-size="12" fill="#fff">${esc(map.name)}${lidar ? ` · LIDAR RELIEF (${lidarFrom})` : ""} · grid ${step} m · x ${x0}..${x1}, y ${y0}..${y1}</text></svg>`;
writeFileSync(out, await sharp(photo).resize(W, H, { fit: "fill" }).composite([{ input: Buffer.from(svg) }]).png().toBuffer());
console.log(out, W, H);
