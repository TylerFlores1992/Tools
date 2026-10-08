import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
const calls = JSON.parse(readFileSync(join(import.meta.dirname, "../studio/campground-maps/splits.json"), "utf8")).listings as { id: string; split: boolean; by: string; on: string; note: string }[];

test("one unit is a place; a listing spread over 1.5 km is areas unless a call keeps it one map; a call splits one that fits", async () => {
  const { viewOf } = await import("../studio/campground-maps/build.mjs");
  assert.equal(viewOf([{ name: "CABIN", at: [0, 0] }]).kind, "unit");
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
    assert.ok(c.by.trim() && c.note.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.on), c.id);
    // A split call the area rules can't honour (Axtel: its loops fit in one area) would read as done.
    const kind = viewOf(mapOf(c.id).sites, c).kind;
    assert.ok(c.split ? kind === "areas" || kind === "dispersed" : kind === "one", `${c.id}: called ${c.split ? "split" : "one map"}, shown as ${kind}`);
  }
});

test("a map the owner approved as one map is never split by the rule", () => {
  const approved = new Set(readdirSync(join(import.meta.dirname, "../src/lab/camphawk/round2/maps/decisions"))
    .flatMap((f) => JSON.parse(readFileSync(join(import.meta.dirname, "../src/lab/camphawk/round2/maps/decisions", f), "utf8")).decisions)
    .filter((d: { decision: string }) => d.decision === "approved").map((d: { id: string }) => d.id));
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
