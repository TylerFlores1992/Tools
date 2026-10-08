import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REASON_LABEL, SAMPLE, reasonCounts, wilson } from "./sample.ts";
import { FIRST_LOOK } from "./sample-review.ts";
import { tidyCase } from "./name.ts";

const MAPS = join(import.meta.dirname, "../../../../../public/private/camphawk/maps");

test("the sample is 50 campgrounds, each with its map file, and the summary counts the entries", () => {
  assert.equal(SAMPLE.entries.length, 50);
  for (const e of SAMPLE.entries) assert.ok(existsSync(join(MAPS, `ridb-${e.id}.json`)), `no map file for ${e.id}`);
  const count = (v: string) => SAMPLE.entries.filter((e) => e.verdict === v).length;
  assert.deepEqual([SAMPLE.summary.ready, SAMPLE.summary.review, SAMPLE.summary.notDrawn], [count("ready"), count("review"), count("not-drawn")]);
});

test("each map file carries the same verdict as the manifest (one build wrote both)", () => {
  for (const e of SAMPLE.entries) {
    const map = JSON.parse(readFileSync(join(MAPS, `ridb-${e.id}.json`), "utf8"));
    assert.equal(map.qa.verdict, e.verdict, e.id);
    assert.ok(Array.isArray(map.bbox) && map.bbox.length === 4, `${e.id} has no bbox for the aerial check`);
  }
});

test("every sample map has a first look, and no first look names a map outside the sample", () => {
  const ids = new Set(SAMPLE.entries.map((e) => e.id));
  for (const id of ids) assert.ok(FIRST_LOOK[id], `no first look for ${id}`);
  for (const id of Object.keys(FIRST_LOOK)) assert.ok(ids.has(id), `first look for ${id}, not in the sample`);
});

test("every reason the build gives has a label, and counts are per map", () => {
  for (const e of SAMPLE.entries) for (const r of e.reasons) assert.ok(REASON_LABEL[r.code], `${e.id}: ${r.code}`);
  const counts = reasonCounts(SAMPLE.entries);
  const notReady = SAMPLE.entries.filter((e) => e.verdict !== "ready").length;
  for (const c of counts) assert.ok(c.count <= notReady);
});

test("the 95% range is a Wilson interval (checked against published values)", () => {
  assert.deepEqual(wilson(32, 50), [50, 76]); // 0.502-0.759
  assert.deepEqual(wilson(0, 10), [0, 28]); // 0-0.278
  assert.deepEqual(wilson(5, 5), [57, 100]); // 0.566-1
  assert.deepEqual(wilson(0, 0), [0, 0]);
});

test("names read as CampHawk shows them", () => {
  assert.equal(tidyCase("WARD MTN. CAMPGROUND (MURRAY SUMMIT)"), "Ward Mtn. Campground (Murray Summit)");
  assert.equal(tidyCase("DOG CREEK (KY)"), "Dog Creek (KY)");
  assert.equal(tidyCase("IRON RIDGE - LAKE VESUVIUS"), "Iron Ridge - Lake Vesuvius");
  assert.equal(tidyCase("McCoy's Ferry Campground"), "McCoy's Ferry Campground");
});
