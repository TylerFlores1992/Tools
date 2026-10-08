// Downloads one OpenStreetMap region extract and trims it to the tags the maps read, so a rollout
// reads OSM from a file instead of the API (the API is for editing; 2,196 maps is bulk use).
//
//   node studio/campground-maps/osm-extract.mjs <region>     e.g. us-west, us-south, us-midwest,
//                                                             us-northeast (or us-west/colorado)
//
// Source: OpenStreetMap France's extracts (download.openstreetmap.fr), the same OSM data as the API
// (ODbL). Geofabrik, the usual source, resets the connection from session containers (2026-10-08).
// The download resumes if interrupted and is checked against the published MD5. Then
// `osmium tags-filter` keeps only the tags osmLayers() reads (plus the nodes their ways need), and
// the raw file is deleted: the US is 13.1 GB raw, at about 0.9 MB/s from a session.
//
// Writes .cache/osm/<name>.osm.pbf (trimmed) and .cache/osm/<name>.json:
//   { region, file, poly, url, osmTimestamp, rawBytes, trimmedBytes, md5, filteredOn, box: [w, s, e, n] }
// and .cache/osm/<name>.poly, the extract's published boundary.
// osmTimestamp is the extract's replication time (<region>.state.txt); the map records it.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const OSM_DIR = join(import.meta.dirname, ".cache", "osm");
const BASE = "https://download.openstreetmap.fr/extracts/north-america";
const POLYS = "https://download.openstreetmap.fr/polygons/north-america";

/** What osmLayers() reads (osm.mjs). Ways keep their nodes; relations keep their members. */
export const OSM_TAGS = ["nwr/highway", "nwr/amenity", "nwr/tourism", "nwr/natural=water", "nwr/waterway", "nwr/landuse=reservoir", "nwr/building"];

const nameOf = (region) => region.replace(/\//g, "-");
const curl = (args) => execFileSync("curl", ["-sS", "--fail", "--retry", "5", "--retry-all-errors", ...args], { stdio: ["ignore", "pipe", "inherit"] });

async function md5Of(path) {
  const h = createHash("md5");
  for await (const chunk of createReadStream(path)) h.update(chunk);
  return h.digest("hex");
}

/** The box the data actually covers, [w, s, e, n] (a full read of the file, once). */
export function dataBox(file) {
  const out = execFileSync("osmium", ["fileinfo", "-e", "-g", "data.bbox", file]).toString().trim();
  const m = out.match(/\(([-0-9.]+),([-0-9.]+),([-0-9.]+),([-0-9.]+)\)/);
  if (!m) throw new Error(`${file}: osmium gave no data box (${out})`);
  return m.slice(1).map(Number);
}

export async function extractRegion(region) {
  mkdirSync(OSM_DIR, { recursive: true });
  const name = nameOf(region);
  const raw = join(OSM_DIR, `${name}.raw.osm.pbf`);
  const trimmed = join(OSM_DIR, `${name}.osm.pbf`);
  // The dated file and its MD5 and state are published together; "-latest" may move mid-download.
  const url = `${BASE}/${region}.osm.pbf`;
  const state = curl(["--max-time", "60", `${BASE}/${region}.state.txt`]).toString();
  const osmTimestamp = state.match(/timestamp=([0-9T:\\-]+Z)/)?.[1]?.replace(/\\/g, "") ?? null;
  const md5 = curl(["--max-time", "60", `${url}.md5`]).toString().trim().split(/\s+/)[0];
  console.log(`${region}: downloading ${url} (OSM as of ${osmTimestamp})`);
  curl(["-C", "-", "--max-time", "21600", "-o", raw, url]);
  const got = await md5Of(raw);
  if (got !== md5) { rmSync(raw); throw new Error(`${region}: MD5 ${got} isn't the published ${md5}; deleted, run again`); }
  const rawBytes = statSync(raw).size;
  console.log(`${region}: ${(rawBytes / 1e9).toFixed(2)} GB, MD5 ok; trimming`);
  execFileSync("osmium", ["tags-filter", raw, ...OSM_TAGS, "-o", trimmed, "--overwrite"], { stdio: "inherit" });
  const trimmedBytes = statSync(trimmed).size;
  rmSync(raw);
  // The extract's boundary, so osm.mjs reads only the extracts a campground is actually in.
  writeFileSync(join(OSM_DIR, `${name}.poly`), curl(["--max-time", "60", `${POLYS}/${region}.poly`]));
  const info = { region, file: `${name}.osm.pbf`, poly: `${name}.poly`, url, osmTimestamp, rawBytes, trimmedBytes, md5, filteredOn: new Date().toISOString(), box: dataBox(trimmed) };
  writeFileSync(join(OSM_DIR, `${name}.json`), JSON.stringify(info, null, 1) + "\n");
  console.log(`${region}: trimmed to ${(trimmedBytes / 1e9).toFixed(2)} GB → ${trimmed}`);
  return info;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const regions = process.argv.slice(2);
  if (!regions.length) { console.error("usage: osm-extract.mjs <region>…   (us-west, us-south, us-midwest, us-northeast)"); process.exit(1); }
  for (const r of regions) {
    const done = join(OSM_DIR, `${nameOf(r)}.json`);
    if (existsSync(done)) {
      // Trimmed before the boundary was kept: fetch just the boundary.
      const info = JSON.parse(readFileSync(done, "utf8"));
      if (!info.poly) {
        writeFileSync(join(OSM_DIR, `${nameOf(r)}.poly`), curl(["--max-time", "60", `${POLYS}/${r}.poly`]));
        writeFileSync(done, JSON.stringify({ ...info, poly: `${nameOf(r)}.poly` }, null, 1) + "\n");
        console.log(`${r}: boundary added`);
      } else console.log(`${r}: already trimmed (delete its .json to redo)`);
      continue;
    }
    await extractRegion(r);
  }
}
