// Picks a reproducible random sample of Recreation.gov campgrounds to build maps for, so "how many
// maps would pass automatically?" is measured on campgrounds nobody chose by hand.
//
//   node studio/campground-maps/sample.mjs <ridb-dir> [count=50] [seed=20261007]
//
// <ridb-dir> holds the unzipped RIDB full export (Facilities, Campsites, FacilityAddresses,
// RecAreas CSVs). Writes specs/ridb-sample.json.
//
// The population is what a rollout would actually draw: campgrounds (RIDB facility type
// "Campground") that are reservable and enabled, counting only overnight sites that aren't staff
// sites, where at least 90% of those sites have a point. That is 3,212 campgrounds on the
// 2026-10-06 export. (The earlier "3,623" counted day-use sites too, so it included 411 picnic and
// shelter facilities with no overnight site at all.)
//
// Of those, 1,016 are a single unit (a cabin, a fire lookout, a guard station, one group site).
// One unit has nothing to tell apart, so it needs no site map: it is counted exactly, not sampled.
// The sample is drawn from the other 2,196, which have two or more sites. (The first draw took
// all 3,212 and 17 of its 50 were single units; the rule was changed then, before any map was
// built.)
//
// The draw is stratified by agency in proportion to the population (largest remainder), and
// random within each agency (mulberry32, seeded), so the sample has the population's mix of
// Forest Service, Army Corps, Park Service and BLM campgrounds and can be re-drawn exactly.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { csvObjects } from "./ridb.mjs";

const [ridbDir, countArg = "50", seedArg = "20261007"] = process.argv.slice(2);
if (!ridbDir) { console.error("usage: sample.mjs <ridb-dir> [count] [seed]"); process.exit(1); }
const COUNT = Number(countArg), SEED = Number(seedArg);

export const AGENCY = { 126: "Bureau of Land Management", 127: "Fish and Wildlife Service", 128: "National Park Service", 129: "Bureau of Reclamation", 130: "US Army Corps of Engineers", 131: "Forest Service", 260: "Navy" };

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
for (const a of csvObjects(join(ridbDir, "FacilityAddresses_API_v1.csv"))) if (fac.has(a.FacilityID) && a.AddressStateCode && !state.has(a.FacilityID)) state.set(a.FacilityID, a.AddressStateCode.toUpperCase());
const recArea = new Map();
for (const r of csvObjects(join(ridbDir, "RecAreas_API_v1.csv"))) recArea.set(r.RecAreaID, r.RecAreaName);

const has = (s) => Number(s.CampsiteLatitude) && Number(s.CampsiteLongitude);
const population = [...sites]
  .map(([id, list]) => ({ id, total: list.length, placed: list.filter(has).length }))
  .filter((c) => c.placed / c.total >= 0.9)
  .sort((a, b) => a.id.localeCompare(b.id));
const singles = population.filter((c) => c.total === 1);
const multi = population.filter((c) => c.total >= 2);

// Stratify by agency, largest remainder.
const strata = new Map();
for (const c of multi) { const a = fac.get(c.id).OrgFacilityID; (strata.get(a) ?? strata.set(a, []).get(a)).push(c); }
const quota = [...strata].map(([a, list]) => ({ a, exact: (list.length / multi.length) * COUNT }));
quota.forEach((q) => (q.n = Math.floor(q.exact)));
let left = COUNT - quota.reduce((s, q) => s + q.n, 0);
for (const q of [...quota].sort((x, y) => (y.exact - y.n) - (x.exact - x.n))) { if (left-- <= 0) break; q.n++; }

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = mulberry32(SEED);
const picked = [];
for (const q of quota.sort((x, y) => Number(x.a) - Number(y.a))) {
  const list = [...strata.get(q.a)];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  for (const c of list.slice(0, q.n)) {
    const f = fac.get(c.id);
    picked.push({ id: c.id, name: f.FacilityName.trim(), agency: AGENCY[q.a] ?? q.a, state: state.get(c.id) ?? "", recArea: recArea.get(f.ParentRecAreaID) ?? "", overnightSites: c.total, placed: c.placed });
  }
}

const out = {
  drawn: { seed: SEED, count: COUNT, export: "RIDB full export, 2026-10-06" },
  population: {
    campgrounds: population.length,
    singleUnit: { campgrounds: singles.length, note: "One cabin, lookout, guard station or group site: no site map needed." },
    multiSite: { campgrounds: multi.length, byAgency: Object.fromEntries([...strata].map(([a, l]) => [AGENCY[a] ?? a, l.length])) },
  },
  quota: Object.fromEntries(quota.map((q) => [AGENCY[q.a] ?? q.a, q.n])),
  picked,
};
const file = join(import.meta.dirname, "specs/ridb-sample.json");
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`${file}\n  population ${population.length} (${singles.length} single units, ${multi.length} sampled from); quota ${JSON.stringify(out.quota)}`);
