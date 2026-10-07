// Builds every campground in specs/ridb-sample.json and writes the lab's review manifest.
//
//   NODE_USE_ENV_PROXY=1 node studio/campground-maps/build-sample.mjs <ridb-dir> [facility-id…]
//
// With ids, only those campgrounds are rebuilt (after adding a trace, say) and the rest of the
// manifest is kept as it was.
//
// Each map goes to public/private/camphawk/maps/ridb-<id>.json (served only to a signed-in lab
// visitor; the review page loads one when it's opened). The manifest, with each map's automatic
// check and a small thumbnail, goes to src/lab/camphawk/round2/maps/sample-manifest.json.
//
// A campground whose sources fail is recorded with the error and the run carries on; run it
// again to retry those (everything that answered is cached in .cache/). Three campgrounds build
// at once, so OpenStreetMap's API sees at most three small requests in flight.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildRidbMap, loadRidb } from "./build.mjs";

const [ridbDir, ...only] = process.argv.slice(2);
if (!ridbDir) { console.error("usage: build-sample.mjs <ridb-dir> [facility-id…]"); process.exit(1); }
const ROOT = join(import.meta.dirname, "../..");
const spec = JSON.parse(readFileSync(join(import.meta.dirname, "specs/ridb-sample.json"), "utf8"));
const MAPS = join(ROOT, "public/private/camphawk/maps");
mkdirSync(MAPS, { recursive: true });

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
function thumb(map) {
  const simple = (d, close) => pathD(parse(d).map((p) => simplify(p, 2)).filter((p) => p.length > 1), close);
  return {
    frame: map.frame,
    roads: map.roads.map((r) => ({ service: r.cls === "Service", d: simple(r.d, false) })),
    water: map.water.map((w) => simple(w.d, true)).filter(Boolean),
    dots: map.sites.filter((s) => s.at).map((s) => [Math.round(s.at[0]), Math.round(s.at[1])]),
  };
}

const ids = spec.picked.map((p) => p.id);
const unknown = only.filter((id) => !ids.includes(id));
if (unknown.length) { console.error(`not in the sample: ${unknown.join(", ")}`); process.exit(1); }
const MANIFEST = join(ROOT, "src/lab/camphawk/round2/maps/sample-manifest.json");
const before = only.length && existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")).entries : [];
console.log(`loading RIDB for ${only.length || ids.length} campgrounds…`);
const ridb = loadRidb(ridbDir, only.length ? only : ids);
// Three at a time: each build waits mostly on remote services (USGS can take a minute to fail).
// Results keep the sample's order.
const entries = new Array(ids.length);
let next = 0;
async function worker() {
  while (next < ids.length) {
    const i = next++, p = spec.picked[i];
    if (only.length && !only.includes(p.id)) { entries[i] = before.find((e) => e.id === p.id); continue; }
    const label = `${String(i + 1).padStart(2)}/${ids.length} ${p.id} ${p.name}`;
    try {
      const { map, qa } = await buildRidbMap(ridb, p.id, p);
      writeFileSync(join(MAPS, `ridb-${p.id}.json`), JSON.stringify(map) + "\n");
      entries[i] = { id: p.id, name: map.name, agency: map.agency, state: p.state, recArea: p.recArea, verdict: qa.verdict, reasons: qa.reasons, checks: qa.checks, metrics: qa.metrics, sources: map.sources, layers: { roads: map.roads.length, trails: map.trails.length, water: map.water.length, buildings: map.buildings.length, pois: map.pois.length }, thumb: thumb(map) };
      console.log(`${label}: ${qa.verdict}${qa.reasons.length ? " (" + qa.reasons.map((r) => r.text).join("; ") + ")" : ""}`);
    } catch (e) {
      entries[i] = { id: p.id, name: p.name, agency: p.agency, state: p.state, recArea: p.recArea, error: String(e.message ?? e).slice(0, 300) };
      console.log(`${label}: FAILED ${e.message}`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);

const count = (v) => entries.filter((e) => e.verdict === v).length;
const manifest = {
  built: new Date().toISOString().slice(0, 10),
  drawn: spec.drawn,
  population: spec.population,
  summary: { ready: count("ready"), review: count("review"), notDrawn: count("not-drawn"), failed: entries.filter((e) => e.error).length },
  entries,
};
if (entries.some((e) => !e)) throw new Error("a campground is missing from the manifest; rebuild the whole sample");
writeFileSync(MANIFEST, JSON.stringify(manifest) + "\n");
console.log(JSON.stringify(manifest.summary));
