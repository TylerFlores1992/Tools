import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entryOf, thumb, updateIndex } from "../studio/campground-maps/build-wave.mjs";

const MAP = {
  name: "Test", agency: "Forest Service", frame: { x: 0, y: 0, w: 100, h: 80 },
  roads: [{ cls: "Service", d: "M0 0L10 0.4L20 0L30 0" }, { cls: "Local", d: "M0 50L100 50" }],
  water: [{ d: "M0 0L5 0L5 5Z" }], trails: [], buildings: [], pois: [],
  sites: [{ at: [10.4, 20.6] }, { at: null }], sources: { roads: "osm" },
};

test("a thumbnail simplifies roads to 2 m, keeps water rings closed and drops sites with no point", () => {
  const t = thumb(MAP);
  assert.deepEqual(t.roads, [{ service: true, d: "M0 0L30 0" }, { service: false, d: "M0 50L100 50" }]);
  assert.deepEqual(t.water, ["M0 0L5 0L5 5Z"]);
  assert.deepEqual(t.dots, [[10, 21]]);
});

test("a manifest entry never says why the campground is in its wave (the watched list stays out)", () => {
  const qa = { verdict: "ready", reasons: [], checks: [], metrics: {} };
  assert.ok(!("why" in entryOf({ id: "1", state: "CA", recArea: "", why: "watched" }, MAP, qa)));
  assert.ok(!("why" in entryOf({ id: "1", state: "CA", recArea: "" }, MAP, qa)));
});

test("no committed wave manifest marks a campground as watched", () => {
  const dir = join(import.meta.dirname, "../public/private/camphawk/maps/waves");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const m = JSON.parse(readFileSync(join(dir, f), "utf8"));
    assert.ok(m.entries.length > 0, f);
    assert.ok(m.entries.every((e: object) => !("why" in e) && !("reservations" in e)), f);
  }
});

test("the wave index keeps one row per wave, in order, and replaces a rebuilt wave's row", () => {
  const file = join(mkdtempSync(join(tmpdir(), "waves-")), "waves.json");
  writeFileSync(file, JSON.stringify({ waves: [{ wave: 2, count: 9 }] }));
  const m = (wave: number, ready: number) => ({ wave, built: "2026-10-08", entries: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })), summary: { ready, review: 0, notDrawn: 0, failed: 0 }, drawn: { order: "o", export: "e" } });
  updateIndex(m(1, 60), file);
  updateIndex(m(1, 61), file);
  const idx = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(idx.waves.map((w: { wave: number }) => w.wave), [1, 2]);
  assert.equal(idx.waves[0].summary.ready, 61);
  assert.equal(idx.waves[0].count, 100);
  assert.equal(idx.waves[0].ids.length, 100);
});

// --- How a camper sees a listing, and the reviewers' split calls (splits.json) ---
const MAPS = join(import.meta.dirname, "../public/private/camphawk/maps");
const mapOf = (id: string) => JSON.parse(readFileSync(join(MAPS, `ridb-${id}.json`), "utf8"));
const SPLITS_DIR = join(import.meta.dirname, "../studio/campground-maps/splits");
const callFiles = [join(import.meta.dirname, "../studio/campground-maps/splits.json"), ...(existsSync(SPLITS_DIR) ? readdirSync(SPLITS_DIR).filter((f) => f.endsWith(".json")).map((f) => join(SPLITS_DIR, f)) : [])];
const calls = callFiles.flatMap((f) => JSON.parse(readFileSync(f, "utf8")).listings) as { id: string; split: boolean; by: string; on: string; note: string }[];

test("one unit is a place; a listing spread over 1.5 km is areas unless a call keeps it one map; a call splits one that fits", async () => {
  const { viewOf } = await import("../studio/campground-maps/build.mjs");
  assert.equal(viewOf([{ name: "CABIN", at: [0, 0] }]).kind, "unit");
  // One site named "Standard" is a first-come campground, not a unit (the owner's pick, 2026-10-08).
  assert.equal(viewOf([{ name: "Standard", at: [0, 0] }]).kind, "firstcome");
  assert.equal(viewOf([{ name: " standard ", at: [0, 0] }]).kind, "firstcome");
  assert.equal(viewOf([{ name: "Standard 2", at: [0, 0] }]).kind, "unit");
  const diamond = mapOf("231980").sites; // 3.5 km of shore
  assert.equal(viewOf(diamond).kind, "areas");
  assert.equal(viewOf(diamond, { split: false }).kind, "one");
  const lithia = mapOf("233539").sites; // four fingers of a lake within 1.5 km
  assert.equal(viewOf(lithia).kind, "one");
  assert.equal(viewOf(lithia, { split: true }).kind, "areas");
});

test("every split call is well formed, for a built map, and holds: split is areas, not split is one map", async () => {
  const { viewOf } = await import("../studio/campground-maps/build.mjs");
  const built = new Set(readdirSync(MAPS).map((f) => f.match(/^ridb-(\d+)\.json$/)?.[1]).filter(Boolean));
  assert.equal(new Set(calls.map((c) => c.id)).size, calls.length, "an id called twice");
  for (const c of calls) {
    assert.ok(built.has(c.id), `${c.id}: no map built`);
    assert.equal(typeof c.split, "boolean", c.id);
    for (const k of ["gap", "maxSpan"] as const) if (k in c) assert.ok(c.split && Number.isFinite((c as Record<string, unknown>)[k]) && ((c as unknown as Record<string, number>)[k]) > 0, `${c.id}: ${k}`);
    assert.ok(c.by.trim() && c.note.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.on), c.id);
    // A split call the area rules can't honour (Axtel: its loops fit in one area) would read as done.
    const kind = viewOf(mapOf(c.id).sites, c).kind;
    assert.ok(c.split ? kind === "areas" || kind === "dispersed" : kind === "one", `${c.id}: called ${c.split ? "split" : "one map"}, shown as ${kind}`);
  }
});

test("a map the owner approved as one map is never split by the rule", () => {
  const approved = new Set(readdirSync(join(import.meta.dirname, "../src/lab/camphawk/round2/maps/decisions"))
    .flatMap((f) => JSON.parse(readFileSync(join(import.meta.dirname, "../src/lab/camphawk/round2/maps/decisions", f), "utf8")).decisions)
    // The owner's approvals only: approved as areas is the owner approving the split itself
    // (2026-10-08), and the rollout's final check judges each map as built, areas included.
    .filter((d: { decision: string; note: string; by: string }) => d.decision === "approved" && d.by === "Owner" && !/as areas/i.test(d.note)).map((d: { id: string }) => d.id));
  for (const id of approved) {
    let m; try { m = mapOf(id); } catch { continue; }
    if (m.split) assert.ok(calls.some((c) => c.id === id && c.split), `${id}: approved as one map, now ${m.split.kind}`);
  }
});

test("a manifest entry carries each area's check when the listing is shown as areas, and nothing when it isn't", () => {
  const areas = [{ name: "Loop A", verdict: "ready", reasons: [] }, { name: "Loop B", verdict: "review", reasons: [{ code: "far-from-roads", text: "x" }] }];
  const qa = { verdict: "review", reasons: [{ code: "areas", text: "Shown as 2 areas" }], checks: [], metrics: {}, areas };
  assert.deepEqual(entryOf({ id: "1", state: "CA", recArea: "" }, MAP, qa).areas, areas);
  assert.ok(!("areas" in entryOf({ id: "1", state: "CA", recArea: "" }, MAP, { ...qa, areas: undefined })));
});

test("every committed map shown as areas says so in its wave's manifest, with each area's check in the map's order", () => {
  const manifests = [
    JSON.parse(readFileSync(join(import.meta.dirname, "../src/lab/camphawk/round2/maps/sample-manifest.json"), "utf8")),
    ...readdirSync(join(MAPS, "waves")).map((f) => JSON.parse(readFileSync(join(MAPS, "waves", f), "utf8"))),
  ];
  let n = 0;
  for (const m of manifests) for (const e of m.entries) {
    let map; try { map = mapOf(e.id); } catch { continue; }
    if (map.split?.kind === "areas") {
      n++;
      assert.equal(e.reasons[0]?.code, "areas", e.id);
      assert.deepEqual(e.areas?.map((a: { name: string }) => a.name), map.split.areas.map((a: { name: string }) => a.name), e.id);
    } else assert.ok(!e.areas && !e.reasons.some((r: { code: string }) => r.code === "areas"), e.id);
    if (map.split?.kind === "dispersed") assert.equal(e.reasons[0]?.code, "dispersed", e.id);
  }
  assert.ok(n >= 25, `${n} listings shown as areas`);
});

test("split calls are read from splits.json and every file in splits/, so parallel waves never share a file", async () => {
  const { splitCalls } = await import("../studio/campground-maps/build.mjs");
  const dir = mkdtempSync(join(tmpdir(), "splits-"));
  const main = join(dir, "splits.json"), sub = join(dir, "splits");
  writeFileSync(main, JSON.stringify({ version: 1, listings: [{ id: "1", split: true }] }));
  const { mkdirSync } = await import("node:fs");
  mkdirSync(sub);
  writeFileSync(join(sub, "wave-09.json"), JSON.stringify({ version: 1, listings: [{ id: "2", split: false }] }));
  const got = splitCalls(main, sub);
  assert.deepEqual([...got.keys()].sort(), ["1", "2"]);
  assert.equal(splitCalls(main, join(dir, "none")).size, 1);
});

test("the lab's wave list and import lists match the files present (run studio/campground-maps/lab-index.mjs after merging waves)", async () => {
  const { outputs, withImports } = await import("../studio/campground-maps/lab-index.mjs");
  for (const [file, text] of outputs()) assert.equal(readFileSync(file, "utf8"), text, `${file} is out of date: run node studio/campground-maps/lab-index.mjs`);
  // A new wave's file adds its import and its place in the list, in order.
  const src = 'import type { X } from "./x";\nimport wave01 from "./wave-01.json" with { type: "json" };\nexport const L: T[] = [wave01 as T];\n';
  assert.equal(withImports(src, [1, 3], { from: "", list: { name: "export const L: T[] =", type: "T" } }),
    'import type { X } from "./x";\nimport wave01 from "./wave-01.json" with { type: "json" };\nimport wave03 from "./wave-03.json" with { type: "json" };\nexport const L: T[] = [wave01 as T, wave03 as T];\n');
});

test("the rollout plan: near-equal waves within a region, most-reserved first, multi-site before units, and no campground twice", async () => {
  const { chunk, planRollout, regionOf } = await import("../studio/campground-maps/plan-rollout.mjs");
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2).map((c: number[]) => c.length), [2, 1, 2]);
  assert.deepEqual(chunk([], 100), []);
  const square = (x0: number, y0: number) => ({ outer: [[[x0, y0], [x0 + 10, y0], [x0 + 10, y0 + 10], [x0, y0 + 10]]], holes: [] });
  const list = [{ region: "west", rings: square(0, 0) }, { region: "east", rings: square(20, 0) }];
  assert.equal(regionOf([5, 5], list), "west");
  assert.equal(regionOf([25, 5], list), "east");
  assert.equal(regionOf([-50, 60], list), "api");
  const c = (id: string) => ({ id, name: id, agency: "Forest Service", state: "", recArea: "" });
  const at: Record<string, [number, number]> = { a: [1, 1], b: [2, 2], c: [3, 3], d: [21, 1], u: [4, 4], x: [9, 9] };
  const waves = planRollout({ multi: ["a", "b", "c", "d", "x"].map(c), singles: [c("u")], done: new Set(["x"]), pointOf: (id: string) => at[id], list, reservations: new Map([["b", 50], ["c", 9]]), size: 2 });
  assert.deepEqual(waves.map((w: { region: string; kind: string; picked: { id: string }[] }) => [w.kind, w.region, w.picked.map((p) => p.id)]), [
    ["multi", "west", ["b", "c"]], ["multi", "west", ["a"]], ["multi", "east", ["d"]], ["units", "west", ["u"]],
  ]);
});

test("the planned waves share no campground with each other or with an earlier wave", () => {
  const SPECS = join(import.meta.dirname, "../studio/campground-maps/specs");
  const seen = new Map<string, string>();
  for (const f of readdirSync(SPECS).filter((f) => /^(wave-\d+|ridb-sample)\.json$/.test(f))) {
    for (const p of JSON.parse(readFileSync(join(SPECS, f), "utf8")).picked) {
      assert.ok(!seen.has(p.id), `${p.id} in ${seen.get(p.id)} and ${f}`);
      seen.set(p.id, f);
      assert.ok(!("why" in p) && !("reservations" in p), `${f}: ${p.id} says why it was picked`);
    }
  }
});

test("the rollout's batches cover every planned wave once, each from one extract", () => {
  const SPECS = join(import.meta.dirname, "../studio/campground-maps/specs");
  const { batches } = JSON.parse(readFileSync(join(SPECS, "rollout.json"), "utf8")) as { batches: { name: string; extract: string; waves: number[] }[] };
  const planned = readdirSync(SPECS).map((f) => f.match(/^wave-(\d+)\.json$/)?.[1]).filter(Boolean).map(Number).filter((n) => JSON.parse(readFileSync(join(SPECS, `wave-${String(n).padStart(2, "0")}.json`), "utf8")).drawn.region);
  const inBatches = batches.flatMap((b) => b.waves);
  assert.equal(new Set(inBatches).size, inBatches.length, "a wave in two batches");
  assert.deepEqual([...inBatches].sort((a, b) => a - b), planned.sort((a, b) => a - b));
  for (const b of batches) for (const n of b.waves) {
    const r = JSON.parse(readFileSync(join(SPECS, `wave-${String(n).padStart(2, "0")}.json`), "utf8")).drawn.region;
    assert.ok(r === b.extract || r === "api", `${b.name}: wave ${n} is ${r}, not ${b.extract}`);
  }
});

test("the final check's decisions: good and usable pass, hold and unsure are held, its own calls override, and every map gets one", async () => {
  const { decideWave } = await import("../studio/campground-maps/decide-wave.mjs");
  const manifest = { entries: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e", error: "x" }] };
  const looks = { a: { call: "good" }, b: { call: "usable" }, c: { call: "hold" }, d: { call: "unsure" } };
  const f = decideWave({ wave: 9, manifest, looks, checked: 4, on: "2026-10-08" });
  assert.deepEqual(f.decisions.map((d: { id: string; decision: string }) => [d.id, d.decision]), [["a", "approved"], ["b", "approved"], ["c", "hidden"], ["d", "hidden"]]);
  const o = decideWave({ wave: 9, manifest, looks, hold: ["b"], pass: ["d"], checked: 4, on: "2026-10-08" });
  assert.deepEqual(o.decisions.map((d: { decision: string }) => d.decision), ["approved", "hidden", "hidden", "approved"]);
  assert.match(o.source, /2 overridden/);
  // The reason for an override is kept on the overridden maps only.
  const y = decideWave({ wave: 9, manifest, looks, hold: ["b"], checked: 4, on: "2026-10-08", why: "too many sites with no road" });
  assert.match(y.decisions[1].note, /held, too many sites with no road\./);
  assert.doesNotMatch(y.decisions[0].note, /too many sites/);
  // A whole campground booked as one "Standard" site is held, whatever the first look said.
  const w = decideWave({ wave: 9, manifest, looks, wholeCampgrounds: ["a"], checked: 4, on: "2026-10-08" });
  assert.equal(w.decisions[0].decision, "hidden");
  assert.match(w.decisions[0].note, /Standard/);
  // Looked at as a first-come map (the owner's pick, 2026-10-08): its call decides, both ways.
  const fc = decideWave({ wave: 9, manifest, looks: { ...looks, a: { call: "good", as: "firstcome" }, c: { call: "hold", as: "firstcome" } }, wholeCampgrounds: ["a", "c"], checked: 4, on: "2026-10-08" });
  assert.equal(fc.decisions[0].decision, "approved");
  assert.equal(fc.decisions[2].decision, "hidden");
  assert.throws(() => decideWave({ wave: 9, manifest, looks: { a: { call: "good" } }, checked: 1, on: "2026-10-08" }), /no first look for b/);
  assert.throws(() => decideWave({ wave: 9, manifest, looks, hold: ["zz"], checked: 1, on: "2026-10-08" }), /not in the wave: zz/);
});

test("the build keeps each outline ring's OpenStreetMap name, in the path's order", async () => {
  const { outlineEvidence } = await import("../studio/campground-maps/build.mjs");
  // A stand-in for geo.mjs pathOf: a ring the frame clips away gives "".
  const pathOf = (parts: number[][][]) => (parts[0][0][0] > 1000 ? "" : `M${parts[0].map((p) => p.join(" ")).join("L")}Z`);
  const ev = outlineEvidence([
    { name: "Fouts Campground", rings: [[[0, 0], [1, 0], [1, 1]], [[2000, 0], [2001, 0], [2001, 1]], [[5, 5], [6, 5], [6, 6]]] },
    { name: "", rings: [[[9, 9], [10, 9], [10, 10]]] },
  ], pathOf);
  assert.deepEqual(ev.outlineNames, ["Fouts Campground", "Fouts Campground", ""]);
  assert.equal(ev.outline, "M0 0L1 0L1 1ZM5 5L6 5L6 6ZM9 9L10 9L10 10Z");
});
