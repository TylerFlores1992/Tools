// The Recreation.gov campgrounds a rollout draws, and the next wave of them to build.
//
//   node studio/campground-maps/population.mjs <ridb-dir> --export=YYYY-MM-DD
//        [--watched=<file.json>] [--reservations=<counts.json>] [--size=100]
//
// The population (readPopulation) is the sample's rule (sample.mjs uses this same function):
// RIDB facility type "Campground", reservable and enabled, counting only overnight sites that
// aren't staff sites, where at least 90% of those sites have a point. Single units (one cabin,
// lookout or group site) need a location map, not a site map (playbook §5.1); the rest is what
// the waves draw. Writes specs/ridb-all.json (every multi-site campground, with its counts).
//
// The next wave (planWave) is about `size` campgrounds no earlier wave has, ordered by demand
// (the owner's decision, 2026-10-08):
//   1. every campground a CampHawk user has watched (`--watched`, re-read read-only from
//      campsite-finder before each wave; the file and its counts are NEVER committed: this
//      repository is public, and with few users a campground can point to one person);
//   2. then the rest, stratified by agency like the sample (so a wave's agency mix matches the
//      population's), most-reserved first within each agency: overnight camping reservations in
//      Recreation.gov's FY2025 historical reservation data (`--reservations`, from
//      reservations-count.py; public RIDB data, only per-facility totals are kept).
// The wave is written as specs/wave-NN.json in the sample's format, so build-wave.mjs reads it.
// A wave ordered by demand is not a random sample: its pass rate describes popular campgrounds,
// and the sample (wave 0) stays the estimate for the whole population.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { csvObjects } from "./ridb.mjs";

export const AGENCY = { 126: "Bureau of Land Management", 127: "Fish and Wildlife Service", 128: "National Park Service", 129: "Bureau of Reclamation", 130: "US Army Corps of Engineers", 131: "Forest Service", 260: "Navy" };
const SPECS = join(import.meta.dirname, "specs");

// RIDB's address table mostly writes a state code, sometimes the full name ("OREGON").
const STATES = "AL Alabama AK Alaska AZ Arizona AR Arkansas CA California CO Colorado CT Connecticut DE Delaware FL Florida GA Georgia HI Hawaii ID Idaho IL Illinois IN Indiana IA Iowa KS Kansas KY Kentucky LA Louisiana ME Maine MD Maryland MA Massachusetts MI Michigan MN Minnesota MS Mississippi MO Missouri MT Montana NE Nebraska NV Nevada NH New_Hampshire NJ New_Jersey NM New_Mexico NY New_York NC North_Carolina ND North_Dakota OH Ohio OK Oklahoma OR Oregon PA Pennsylvania RI Rhode_Island SC South_Carolina SD South_Dakota TN Tennessee TX Texas UT Utah VT Vermont VA Virginia WA Washington WV West_Virginia WI Wisconsin WY Wyoming".split(" ");
const CODE = new Map(); for (let i = 0; i < STATES.length; i += 2) CODE.set(STATES[i + 1].replace(/_/g, " ").toUpperCase(), STATES[i]);
const stateCode = (raw) => { const s = raw.trim().toUpperCase(); return s.length === 2 ? s : CODE.get(s) ?? ""; };

/**
 * Every campground the rule admits, sorted by id: { id, agencyId, name, agency, state, recArea,
 * overnightSites, placed }. `singles` have one overnight site, `multi` two or more.
 */
export function readPopulation(ridbDir) {
  const fac = new Map();
  for (const f of csvObjects(join(ridbDir, "Facilities_API_v1.csv"))) {
    if (f.FacilityTypeDescription === "Campground" && f.Reservable === "true" && f.Enabled === "true") fac.set(f.FacilityID, f);
  }
  const sites = new Map();
  for (const s of csvObjects(join(ridbDir, "Campsites_API_v1.csv"))) {
    if (!fac.has(s.FacilityID) || s.CampsiteType === "MANAGEMENT" || s.TypeOfUse !== "Overnight") continue;
    (sites.get(s.FacilityID) ?? sites.set(s.FacilityID, []).get(s.FacilityID)).push(s);
  }
  const state = new Map();
  for (const a of csvObjects(join(ridbDir, "FacilityAddresses_API_v1.csv"))) if (fac.has(a.FacilityID) && stateCode(a.AddressStateCode) && !state.has(a.FacilityID)) state.set(a.FacilityID, stateCode(a.AddressStateCode));
  const recArea = new Map();
  for (const r of csvObjects(join(ridbDir, "RecAreas_API_v1.csv"))) recArea.set(r.RecAreaID, r.RecAreaName);

  const has = (s) => Number(s.CampsiteLatitude) && Number(s.CampsiteLongitude);
  const campgrounds = [...sites]
    .map(([id, list]) => ({ id, total: list.length, placed: list.filter(has).length }))
    .filter((c) => c.placed / c.total >= 0.9)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => {
      const f = fac.get(c.id);
      return { id: c.id, agencyId: f.OrgFacilityID, name: f.FacilityName.trim(), agency: AGENCY[f.OrgFacilityID] ?? f.OrgFacilityID, state: state.get(c.id) ?? "", recArea: recArea.get(f.ParentRecAreaID) ?? "", overnightSites: c.total, placed: c.placed };
    });
  return { campgrounds, singles: campgrounds.filter((c) => c.overnightSites === 1), multi: campgrounds.filter((c) => c.overnightSites >= 2) };
}

/** Largest-remainder quotas of `n` across groups, in proportion to their sizes. */
export function quotas(sizes, n) {
  const total = [...sizes.values()].reduce((s, v) => s + v, 0);
  const q = [...sizes].map(([k, v]) => ({ k, exact: total ? (v / total) * n : 0 }));
  q.forEach((x) => (x.n = Math.floor(x.exact)));
  let left = Math.min(n, total) - q.reduce((s, x) => s + x.n, 0);
  for (const x of [...q].sort((a, b) => (b.exact - b.n) - (a.exact - a.n) || String(a.k).localeCompare(String(b.k)))) { if (left-- <= 0) break; x.n++; }
  return new Map(q.map((x) => [x.k, Math.min(x.n, sizes.get(x.k))]));
}

/**
 * The next wave: watched campgrounds first (in the order given), then `size` minus those, split
 * across agencies in proportion to what's left and filled most-reserved first. `done` holds the
 * ids every earlier wave (and the bundled Upper Pines) has. Each pick says why it was picked.
 */
/**
 * The picks as committed to a public repository: id, name, agency, state, rec area and site counts,
 * sorted by agency then id. The plan's order and each pick's reason (watched or most-reserved) stay
 * in the session: with few CampHawk users, a watched campground can point to one person
 * (playbook §4.2: never commit the watched list).
 * @param {any[]} picked
 */
export function committedPicks(picked) {
  return picked
    .map(({ agencyId, why, reservations, ...c }) => c)
    .sort((a, b) => a.agency.localeCompare(b.agency) || String(a.id).localeCompare(String(b.id)));
}

/**
 * @param {any[]} multi
 * @param {{ done?: Set<string>, watched?: string[], reservations?: Map<string, number>, size?: number }} [opts]
 */
export function planWave(multi, { done = new Set(), watched = [], reservations = new Map(), size = 100 } = {}) {
  const left = multi.filter((c) => !done.has(c.id));
  const byId = new Map(left.map((c) => [c.id, c]));
  const picked = watched.filter((id) => byId.has(id)).map((id) => ({ ...byId.get(id), why: "watched" }));
  const taken = new Set(picked.map((c) => c.id));
  const pool = left.filter((c) => !taken.has(c.id));
  const byAgency = new Map();
  for (const c of pool) (byAgency.get(c.agency) ?? byAgency.set(c.agency, []).get(c.agency)).push(c);
  const quota = quotas(new Map([...byAgency].map(([a, l]) => [a, l.length])), Math.max(0, size - picked.length));
  const rank = (c) => reservations.get(c.id) ?? 0;
  for (const [a, list] of [...byAgency].sort((x, y) => String(x[0]).localeCompare(String(y[0])))) {
    const top = [...list].sort((x, y) => rank(y) - rank(x) || x.id.localeCompare(y.id)).slice(0, quota.get(a) ?? 0);
    picked.push(...top.map((c) => ({ ...c, why: "reservations", reservations: rank(c) })));
  }
  return { picked, quota: Object.fromEntries(quota), remaining: left.length - picked.length };
}

/** Ids already in a wave spec (wave-NN.json) or the sample. */
export function doneIds(dir = SPECS) {
  const done = new Set();
  for (const f of readdirSync(dir).filter((f) => /^(wave-\d+|ridb-sample)\.json$/.test(f))) for (const p of JSON.parse(readFileSync(join(dir, f), "utf8")).picked) done.add(p.id);
  return done;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, "").split("=")));
  const ridbDir = process.argv[2];
  if (!ridbDir || !/^\d{4}-\d{2}-\d{2}$/.test(args.export ?? "")) { console.error("usage: population.mjs <ridb-dir> --export=YYYY-MM-DD [--watched=file] [--reservations=file] [--size=100]"); process.exit(1); }
  const { campgrounds, singles, multi } = readPopulation(ridbDir);
  const byAgency = (list) => Object.fromEntries([...list.reduce((m, c) => m.set(c.agency, (m.get(c.agency) ?? 0) + 1), new Map())].sort());
  const all = {
    export: `RIDB full export, ${args.export}`,
    rule: "Facility type Campground, reservable and enabled; overnight non-staff sites only; at least 90% of them with a point.",
    counts: { campgrounds: campgrounds.length, singleUnit: singles.length, multiSite: multi.length, multiSiteByAgency: byAgency(multi) },
    multi: multi.map(({ agencyId, ...c }) => c),
  };
  writeFileSync(join(SPECS, "ridb-all.json"), JSON.stringify(all) + "\n");
  console.log(`population ${campgrounds.length}: ${singles.length} single units, ${multi.length} multi-site (sample's export: 3,212 / 1,016 / 2,196)`);

  // Upper Pines is the lab's bundled map (build.mjs), so no wave rebuilds it.
  const done = doneIds(); done.add("232447");
  const watched = args.watched ? JSON.parse(readFileSync(args.watched, "utf8")).map((w) => String(w.id)) : [];
  const reservations = new Map(args.reservations ? Object.entries(JSON.parse(readFileSync(args.reservations, "utf8")).facilities).map(([k, v]) => [k, Number(v)]) : []);
  const plan = planWave(multi, { done, watched, reservations, size: Number(args.size ?? 100) });
  const n = Math.max(0, ...readdirSync(SPECS).map((f) => Number(f.match(/^wave-(\d+)\.json$/)?.[1] ?? 0))) + 1;
  const out = {
    drawn: {
      wave: n,
      count: plan.picked.length,
      export: `RIDB full export, ${args.export}`,
      order: `CampHawk demand: campgrounds a user has watched first (${plan.picked.filter((p) => p.why === "watched").length}), then by agency in proportion to what's left, most-reserved first (Recreation.gov FY2025 overnight camping reservations)`,
      planned: new Date().toISOString().slice(0, 10),
    },
    population: { campgrounds: campgrounds.length, singleUnit: { campgrounds: singles.length }, multiSite: { campgrounds: multi.length, byAgency: byAgency(multi) }, notYetInAWave: plan.remaining },
    quota: plan.quota,
    // Nothing that says which campgrounds are watched: no counts, no per-pick reason, no
    // reservation counts (their absence would mark the watched), and an order that isn't the plan's.
    picked: committedPicks(plan.picked),
  };
  const file = join(SPECS, `wave-${String(n).padStart(2, "0")}.json`);
  if (existsSync(file)) throw new Error(`${file} exists`);
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`${file}: ${out.picked.length} campgrounds (${out.drawn.order}); ${plan.remaining} left after it`);
}
