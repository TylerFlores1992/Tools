import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LATEST_WAVE, LOOK_LEVEL, SAMPLE_WAVE, WAVES, needsDecision, splitEntries, waveLabel, waveOf } from "./waves.ts";
import { LOOK_FILES } from "./first-look/index.ts";
import { DECISION_FILES, decisionProblems } from "./decisions.ts";

const PUBLIC = join(import.meta.dirname, "../../../../../public/private/camphawk/maps");
const manifestIds = (wave: number): Set<string> => {
  if (wave === 0) return new Set(SAMPLE_WAVE.entries.map((e) => e.id));
  const file = join(PUBLIC, "waves", `wave-${String(wave).padStart(2, "0")}.json`);
  assert.ok(existsSync(file), `wave ${wave}'s manifest is missing (${file})`);
  return new Set(JSON.parse(readFileSync(file, "utf8")).entries.map((e: { id: string }) => e.id));
};

test("waves: the sample first, then each built wave once, in order; a campground is in one wave", () => {
  assert.equal(WAVES[0].wave, 0);
  assert.deepEqual(WAVES.map((w) => w.wave), [...new Set(WAVES.map((w) => w.wave))].sort((a, b) => a - b));
  assert.equal(LATEST_WAVE, WAVES.at(-1)!.wave);
  const seen = new Map<string, number>();
  for (const w of WAVES) for (const id of w.ids) { assert.ok(!seen.has(id), `${id} is in wave ${seen.get(id)} and wave ${w.wave}`); seen.set(id, w.wave); }
  assert.equal(waveOf("274721"), 0);
  assert.equal(waveOf("nope"), null);
  assert.equal(waveLabel(0), "Sample");
  assert.equal(waveLabel(3), "Wave 3");
});

test("every listed wave's manifest is on disk and lists the same campgrounds as the index", () => {
  for (const w of WAVES.filter((x) => x.wave > 0)) assert.deepEqual([...manifestIds(w.wave)].sort(), [...w.ids].sort());
});

test("a failed build is listed apart, never counted as a verdict", () => {
  const ok = { ...SAMPLE_WAVE.entries[0] };
  const { entries, failed } = splitEntries([ok, { id: "9", name: "X", agency: "", state: "", recArea: "", error: "HTTP 504" }]);
  assert.deepEqual(entries.map((e) => e.id), [ok.id]);
  assert.deepEqual(failed.map((f) => f.error), ["HTTP 504"]);
});

test("every first-look file is for a built wave, its maps, with a known call and a note", () => {
  for (const f of LOOK_FILES) {
    assert.equal(f.version, 1);
    assert.ok(f.by.trim() && /^\d{4}-\d{2}-\d{2}$/.test(f.on), `wave ${f.wave}: who and when`);
    const ids = manifestIds(f.wave);
    for (const [id, look] of Object.entries(f.looks)) {
      assert.ok(ids.has(id), `wave ${f.wave}: ${id} isn't in the wave`);
      assert.ok(["good", "usable", "hold", "unsure"].includes(look.call), `wave ${f.wave}: ${id} call ${look.call}`);
      assert.ok(look.note.trim().length > 10, `wave ${f.wave}: ${id} has no note`);
    }
  }
  assert.equal(new Set(LOOK_FILES.map((f) => f.wave)).size, LOOK_FILES.length);
});

test("every decisions file decides only maps of its own wave", () => {
  for (const f of DECISION_FILES) assert.deepEqual(decisionProblems(f, manifestIds(f.wave)), [], `wave ${f.wave}`);
});

test("a map needs a decision when the check held it, or the first look held it or couldn't tell", () => {
  assert.equal(needsDecision({ verdict: "review" }, "good"), true);
  assert.equal(needsDecision({ verdict: "review" }, undefined), true);
  assert.equal(needsDecision({ verdict: "ready" }, "hold"), true, "Cave Spring: every check passed, the photo says no");
  assert.equal(needsDecision({ verdict: "ready" }, "unsure"), true);
  assert.equal(needsDecision({ verdict: "ready" }, "good"), false);
  assert.equal(needsDecision({ verdict: "ready" }, "usable"), false);
  assert.equal(needsDecision({ verdict: "ready" }, undefined), false);
  assert.deepEqual(Object.keys(LOOK_LEVEL).sort(), ["good", "hold", "unsure", "usable"]);
  assert.equal(LOOK_LEVEL.hold, "fail");
  assert.equal(LOOK_LEVEL.good, "ok");
});
