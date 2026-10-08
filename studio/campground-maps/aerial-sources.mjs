// Which public-domain aerial photo answers for each map, measured: what aerial.ts's PICKS records.
// For each map it asks every source that could cover its place for the whole frame (1,000 px) and
// for 300 m around its first site (1,000 px, about 0.3 m a pixel), counts a photo as real when
// under half of the frame is blank (or the site's ground, where the frame isn't wholly blank), and reads the service's catalog for the years and pixel sizes there.
//
//   NODE_USE_ENV_PROXY=1 node studio/campground-maps/aerial-sources.mjs <out.json> public/private/camphawk/maps/ridb-<id>.json …
//
// Prints one line a map and the PICKS a source change would need; writes every answer to out.json.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { AERIAL, PICKS, aerialSource, exportUrl, inAlaska, inHawaii, sizeFor } from "../../src/lab/camphawk/round2/maps/aerial.ts";

const [out, ...files] = process.argv.slice(2);
if (!out || !files.length) { console.error("usage: aerial-sources.mjs <out.json> <map.json>…"); process.exit(1); }

/** The share of a photo that is blank: transparent, or plain white or black (a service with nothing there). */
async function blankShare(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url.replace("format=jpg", "format=png32"), { signal: AbortSignal.timeout(120000) }).catch(() => null);
    if (!res?.ok) continue;
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().resize(200).raw().toBuffer({ resolveWithObject: true }).catch(() => ({}));
    if (!data) continue;
    let blank = 0;
    for (let p = 0; p < data.length; p += info.channels) {
      const [r, g, b, a] = [data[p], data[p + 1], data[p + 2], data[p + 3]];
      if (a < 10 || (r > 250 && g > 250 && b > 250) || (r < 4 && g < 4 && b < 4)) blank++;
    }
    return blank / (data.length / info.channels);
  }
  return null;
}

/** The catalog's datasets over a bbox: name, year, finest pixel size (IIPP services only). */
async function catalog(src, bbox) {
  if (!src.service.includes("geoplatform")) return [];
  const q = new URLSearchParams({ where: "category=1", geometry: JSON.stringify({ xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3], spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "dataset_name,name,endyear,lowps", returnGeometry: "false", f: "json" });
  const res = await fetch(src.service.replace("/exportImage", `/query?${q}`), { signal: AbortSignal.timeout(120000) }).catch(() => null);
  const d = res?.ok ? await res.json().catch(() => null) : null;
  const seen = new Map();
  for (const { attributes: a } of d?.features ?? []) {
    const k = a.dataset_name ?? a.name;
    if (!seen.has(k) || seen.get(k).px > a.lowps) seen.set(k, { dataset: k, year: a.endyear ?? null, px: a.lowps });
  }
  return [...seen.values()];
}

const rows = [];
for (const file of files) {
  const map = JSON.parse(readFileSync(file, "utf8"));
  const f = map.frame, [w, s, e, n] = map.bbox;
  const lon = (x) => w + ((x - f.x) / f.w) * (e - w), lat = (y) => n - ((y - f.y) / f.h) * (n - s);
  const at = map.sites.find((x) => x.at)?.at ?? [f.x + f.w / 2, f.y + f.h / 2];
  const zoom = [lon(at[0] - 150), lat(at[1] + 150), lon(at[0] + 150), lat(at[1] - 150)];
  const [cx, cy] = [(w + e) / 2, (s + n) / 2];
  const keys = inAlaska(cx, cy) ? ["usfs-r10", "usfs-r10-rgb", "usfs-r10-0.6m"] : inHawaii(cx, cy) ? ["naip-hawaii", "naip"] : ["naip"];
  const answers = {};
  for (const k of keys) {
    const src = AERIAL[k];
    answers[k] = {
      frame: await blankShare(exportUrl(src, map.bbox, sizeFor(src, f, 1000))),
      zoom: await blankShare(exportUrl(src, zoom, sizeFor(src, { w: 300, h: 300 }, 1000))),
      catalog: await catalog(src, map.bbox),
    };
  }
  // Real: most of the frame, or the ground around the first site where the frame isn't wholly blank
  // (a unit's 1.4 km frame at a coverage edge).
  const real = (a) => a && a.frame !== null && (a.frame < 0.5 || (a.zoom !== null && a.zoom < 0.5 && a.frame < 0.99));
  const now = aerialSource({ facilityId: map.facilityId, bbox: map.bbox })?.key ?? "none";
  // A pick that answers stands (some are chosen for a clearer photo, not the only one).
  const best = real(answers[now]) ? now : keys.find((k) => real(answers[k])) ?? "none";
  rows.push({ id: map.facilityId, name: map.name, state: map.state, best, now, answers });
  console.log(`${map.facilityId}\t${best}${best === now ? "" : `\t(aerial.ts gives ${now}${PICKS[map.facilityId] ? ", a pick" : ""})`}`);
}
writeFileSync(out, JSON.stringify(rows, null, 1) + "\n");
const fix = rows.filter((r) => r.best !== r.now);
console.log(fix.length ? `\n${fix.length} map(s) need a pick in aerial.ts:\n${fix.map((r) => `  "${r.id}": "${r.best}",`).join("\n")}` : "\naerial.ts agrees with every map measured.");
