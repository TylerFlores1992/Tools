// Builds every campground in a wave spec (population.mjs) and writes the wave's review manifest.
//
//   NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-wave.mjs <ridb-dir> specs/wave-NN.json [facility-id…]
//
// With ids, only those campgrounds are rebuilt (after adding a trace, say) and the rest of the
// manifest is kept as it was. build-sample.mjs is this for the 50-campground sample (wave 0).
//
// Each map goes to public/private/camphawk/maps/ridb-<id>.json (served only to a signed-in lab
// visitor). The manifest, with each map's automatic check and a small thumbnail, goes to
// public/private/camphawk/maps/waves/wave-NN.json, fetched by the review page when that wave is
// chosen (2,196 maps' manifests would be too much to bundle), and the wave's summary to
// src/lab/camphawk/round2/maps/waves.json, which the page lists.
//
// OpenStreetMap is read from the regional extracts only (osm-extract.mjs; a wave is never read
// half from the API), and every campground's box is cut in one pass per extract before the builds
// start (osm.mjs prefetchOsm: one cut reads the whole 3 GB extract).
//
// A campground whose sources fail is recorded with the error and the run carries on; run it
// again to retry those (everything that answered is cached in .cache/). Three build at once.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildRidbMap, frameBoxOf, loadRidb } from "./build.mjs";
import { prefetchOsm } from "./osm.mjs";

const ROOT = join(import.meta.dirname, "../..");
const MAPS = join(ROOT, "public/private/camphawk/maps");
const WAVES = join(MAPS, "waves");
const INDEX = join(ROOT, "src/lab/camphawk/round2/maps/waves.json");

// --- A thumbnail: the roads simplified to 2 m and the site dots, in whole metres. ---
const parse = (d) => d.split("M").filter(Boolean).map((part) => part.replace(/Z$/, "").split("L").map((p) => p.trim().split(" ").map(Number)));
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts.at(-1);
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  let best = -1, at = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > best) { best = d; at = i; } }
  return best <= tol ? [pts[0], pts.at(-1)] : [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}
const pathD = (parts, close) => parts.map((p) => "M" + p.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join("L") + (close ? "Z" : "")).join("");
export function thumb(map) {
  const simple = (d, close) => pathD(parse(d).map((p) => simplify(p, 2)).filter((p) => p.length > 1), close);
  return {
    frame: map.frame,
    roads: map.roads.map((r) => ({ service: r.cls === "Service", d: simple(r.d, false) })),
    water: map.water.map((w) => simple(w.d, true)).filter(Boolean),
    dots: map.sites.filter((s) => s.at).map((s) => [Math.round(s.at[0]), Math.round(s.at[1])]),
  };
}

export const entryOf = (p, map, qa) => ({ id: p.id, name: map.name, agency: map.agency, state: p.state, recArea: p.recArea, verdict: qa.verdict, reasons: qa.reasons, checks: qa.checks, metrics: qa.metrics, sources: map.sources, layers: { roads: map.roads.length, trails: map.trails.length, water: map.water.length, buildings: map.buildings.length, pois: map.pois.length }, thumb: thumb(map) });

/**
 * Build a spec's campgrounds into maps and a manifest. `osm` is "extract" for a wave (no API
 * reads), "auto" for the sample. Returns the manifest.
 */
export async function buildWave({ ridbDir, specFile, manifestFile, only = [], osm = "extract", log = console.log }) {
  const spec = JSON.parse(readFileSync(specFile, "utf8"));
  mkdirSync(MAPS, { recursive: true });
  const ids = spec.picked.map((p) => p.id);
  const unknown = only.filter((id) => !ids.includes(id));
  if (unknown.length) throw new Error(`not in ${basename(specFile)}: ${unknown.join(", ")}`);
  const before = only.length && existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")).entries : [];
  log(`loading RIDB for ${only.length || ids.length} campgrounds…`);
  const ridb = loadRidb(ridbDir, only.length ? only : ids);

  // Cut every box out of the extracts first (one pass per extract), so the builds read OSM from cache.
  const todo = (only.length ? only : ids);
  const boxes = todo.map((id) => frameBoxOf(ridb, id)).filter((b) => b && !b.huge).map((b) => b.bboxArr);
  if (osm !== "api") {
    const t = Date.now();
    const { cut, uncovered } = prefetchOsm(boxes, osm);
    log(`OpenStreetMap: ${cut} boxes cut from the extracts in ${Math.round((Date.now() - t) / 1000)} s${uncovered ? `; ${uncovered} no extract covers (${osm === "extract" ? "they fail; download their region and rebuild them" : "read from the API"})` : ""}`);
  }

  const entries = new Array(ids.length);
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const i = next++, p = spec.picked[i];
      if (only.length && !only.includes(p.id)) { entries[i] = before.find((e) => e.id === p.id); continue; }
      const label = `${String(i + 1).padStart(3)}/${ids.length} ${p.id} ${p.name}`;
      try {
        const { map, qa } = await buildRidbMap(ridb, p.id, { ...p, osm });
        writeFileSync(join(MAPS, `ridb-${p.id}.json`), JSON.stringify(map) + "\n");
        entries[i] = entryOf(p, map, qa);
        log(`${label}: ${qa.verdict}${qa.reasons.length ? " (" + qa.reasons.map((r) => r.text).join("; ") + ")" : ""}`);
      } catch (e) {
        entries[i] = { id: p.id, name: p.name, agency: p.agency, state: p.state, recArea: p.recArea, error: String(e.message ?? e).slice(0, 300) };
        log(`${label}: FAILED ${e.message}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (entries.some((e) => !e)) throw new Error("a campground is missing from the manifest; rebuild the whole wave");

  const count = (v) => entries.filter((e) => e.verdict === v).length;
  const manifest = {
    ...(spec.drawn?.wave != null ? { wave: spec.drawn.wave } : {}),
    built: new Date().toISOString().slice(0, 10),
    drawn: spec.drawn,
    population: spec.population,
    summary: { ready: count("ready"), review: count("review"), notDrawn: count("not-drawn"), failed: entries.filter((e) => e.error).length },
    entries,
  };
  mkdirSync(join(manifestFile, ".."), { recursive: true });
  writeFileSync(manifestFile, JSON.stringify(manifest) + "\n");
  log(JSON.stringify(manifest.summary));
  return manifest;
}

/** The waves the review page lists: number, size, summary, how it was ordered. */
export function updateIndex(manifest, file = INDEX) {
  const index = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { waves: [] };
  const row = { wave: manifest.wave, built: manifest.built, count: manifest.entries.length, summary: manifest.summary, order: manifest.drawn?.order ?? "", export: manifest.drawn?.export ?? "", ids: manifest.entries.map((e) => e.id) };
  index.waves = [...index.waves.filter((w) => w.wave !== manifest.wave), row].sort((a, b) => a.wave - b.wave);
  writeFileSync(file, JSON.stringify(index, null, 1) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [ridbDir, specArg, ...only] = process.argv.slice(2);
  if (!ridbDir || !specArg) { console.error("usage: build-wave.mjs <ridb-dir> specs/wave-NN.json [facility-id…]"); process.exit(1); }
  const specFile = specArg.startsWith("/") ? specArg : join(process.cwd(), specArg);
  const n = JSON.parse(readFileSync(specFile, "utf8")).drawn?.wave;
  if (!Number.isInteger(n) || n < 1) { console.error(`${specArg} isn't a wave spec (no drawn.wave); the sample is built by build-sample.mjs`); process.exit(1); }
  // Extracts only, unless OSM_FROM=auto: Alaska and Hawaii have no OSM France extract (2026-10-08),
  // and their few campgrounds read the API (each map records which; osm.mjs).
  const manifest = await buildWave({ ridbDir, specFile, manifestFile: join(WAVES, `wave-${String(n).padStart(2, "0")}.json`), only, osm: process.env.OSM_FROM ?? "extract" });
  updateIndex(manifest);
}
