// Plans every Recreation.gov campground no wave has yet, as waves a rollout child can build alone
// (2026-10-08, the owner: "orchestrate the rest, each batch to a child"). One run writes
// specs/wave-NN.json for all of them, so parallel children never pick the same campground.
//
//   node studio/campground-maps/plan-rollout.mjs <ridb-dir> --export=YYYY-MM-DD --reservations=<counts.json> [--size=100]
//
// - The population is population.mjs's (readPopulation): multi-site campgrounds and single units.
// - Each campground goes to the OpenStreetMap extract that covers it (osm-extract.mjs's boundaries,
//   read from .cache/osm/), so a child downloads one extract. Alaska and Hawaii have none: those
//   waves read the OSM API (`drawn.osm: "api"`; build-wave.mjs reads it).
// - Within a region, most-reserved first (FY2025, public RIDB data, per-facility totals only; the
//   counts are never written), then cut into waves of at most `size`, near-equal.
// - Multi-site waves first, then single-unit waves (`drawn.kind: "units"`: a location map each).
// - Not by demand any more: the watched campgrounds were all in wave 1, and this plans the rest.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extracts } from "./osm.mjs";
import { committedPicks, doneIds, readPopulation } from "./population.mjs";
import { csvObjects } from "./ridb.mjs";

const SPECS = join(import.meta.dirname, "specs");

const inRing = ([x, y], r) => { let i = false; for (let a = 0, b = r.length - 1; a < r.length; b = a++) { const [xi, yi] = r[a], [xj, yj] = r[b]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) i = !i; } return i; };

/** The extract region whose boundary holds the point, or "api" (Alaska, Hawaii, anywhere uncovered). */
export function regionOf(p, list) {
  for (const x of list) if (x.rings && x.rings.outer.some((r) => inRing(p, r)) && !x.rings.holes.some((r) => inRing(p, r))) return x.region;
  return "api";
}

/** Cut a list into ceil(n / size) near-equal waves, in order. */
export function chunk(list, size) {
  const n = Math.ceil(list.length / size), out = [];
  for (let i = 0; i < n; i++) out.push(list.slice(Math.round((i * list.length) / n), Math.round(((i + 1) * list.length) / n)));
  return out;
}

/**
 * The waves, in order: each { region, kind, picked }. `pointOf(id)` → [lon, lat] (the sites' mean).
 */
export function planRollout({ multi, singles, done, pointOf, list, reservations, size = 100 }) {
  const rank = (c) => reservations.get(c.id) ?? 0;
  const waves = [];
  for (const [kind, pop] of [["multi", multi.filter((c) => !done.has(c.id))], ["units", singles.filter((c) => !done.has(c.id))]]) {
    const byRegion = new Map();
    for (const c of pop) { const r = pointOf(c.id) ? regionOf(pointOf(c.id), list) : "api"; (byRegion.get(r) ?? byRegion.set(r, []).get(r)).push(c); }
    for (const [region, cs] of [...byRegion].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
      const sorted = [...cs].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id));
      for (const picked of chunk(sorted, size)) waves.push({ region, kind, picked });
    }
  }
  return waves;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, "").split("=")));
  const ridbDir = process.argv[2];
  if (!ridbDir || !/^\d{4}-\d{2}-\d{2}$/.test(args.export ?? "") || !args.reservations) { console.error("usage: plan-rollout.mjs <ridb-dir> --export=YYYY-MM-DD --reservations=<counts.json> [--size=100]"); process.exit(1); }
  const list = extracts();
  if (!list.some((x) => x.rings)) { console.error("no extract boundaries in .cache/osm (osm-extract.mjs downloads them)"); process.exit(1); }
  const { campgrounds, singles, multi } = readPopulation(ridbDir);
  const want = new Set(campgrounds.map((c) => c.id)), acc = new Map();
  for (const s of csvObjects(join(ridbDir, "Campsites_API_v1.csv"))) if (want.has(s.FacilityID) && Number(s.CampsiteLatitude) && Number(s.CampsiteLongitude)) { const a = acc.get(s.FacilityID) ?? [0, 0, 0]; a[0] += Number(s.CampsiteLongitude); a[1] += Number(s.CampsiteLatitude); a[2]++; acc.set(s.FacilityID, a); }
  const pointOf = (id) => { const a = acc.get(id); return a ? [a[0] / a[2], a[1] / a[2]] : null; };
  const done = doneIds(); done.add("232447");
  const reservations = new Map(Object.entries(JSON.parse(readFileSync(args.reservations, "utf8")).facilities).map(([k, v]) => [k, Number(v)]));
  const waves = planRollout({ multi, singles, done, pointOf, list, reservations, size: Number(args.size ?? 100) });
  const first = Math.max(0, ...readdirSync(SPECS).map((f) => Number(f.match(/^wave-(\d+)\.json$/)?.[1] ?? 0))) + 1;
  waves.forEach((w, i) => {
    const n = first + i, file = join(SPECS, `wave-${String(n).padStart(2, "0")}.json`);
    if (existsSync(file)) throw new Error(`${file} exists`);
    const where = w.region === "api" ? "Alaska, Hawaii and anywhere no extract covers (OpenStreetMap API)" : `OpenStreetMap extract ${w.region}`;
    writeFileSync(file, JSON.stringify({
      drawn: {
        wave: n, count: w.picked.length, export: `RIDB full export, ${args.export}`, kind: w.kind, region: w.region, osm: w.region === "api" ? "api" : "extract",
        order: `Rollout of everything left, by region (${where}), most-reserved first within it (Recreation.gov FY2025 overnight camping reservations)${w.kind === "units" ? "; single units (a location map each)" : ""}`,
        planned: new Date().toISOString().slice(0, 10),
      },
      population: { campgrounds: campgrounds.length, singleUnit: { campgrounds: singles.length }, multiSite: { campgrounds: multi.length } },
      picked: committedPicks(w.picked),
    }, null, 2) + "\n");
    console.log(`wave ${n}: ${w.kind} ${w.region} ${w.picked.length}`);
  });
}
