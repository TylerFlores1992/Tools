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
