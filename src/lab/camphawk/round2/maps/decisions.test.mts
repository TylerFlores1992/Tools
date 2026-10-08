import assert from "node:assert/strict";
import test from "node:test";
import { DECISION_FILES, RECORDED, decisionProblems, decisionsFileFor, suggestedDecision, type DecisionFile } from "./decisions.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE } from "./sample.ts";
import first01 from "./first-look/wave-01.json" with { type: "json" };

const sampleIds = new Set(SAMPLE.entries.map((e) => e.id));
type ManifestEntry = { id: string; verdict: string; reasons: { code: string }[] };
const manifest = (n: number): ManifestEntry[] =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../../../../../public/private/camphawk/maps/waves/wave-${String(n).padStart(2, "0")}.json`), "utf8")).entries;
const idsOf = (wave: number) => wave === 0 ? sampleIds : new Set(manifest(wave).map((e) => e.id));
const ofWave = (wave: number) => DECISION_FILES.find((f) => f.wave === wave)!.decisions;

test("every recorded decision is for a map in its wave and is well formed", () => {
  for (const f of DECISION_FILES) assert.deepEqual(decisionProblems(f, idsOf(f.wave)), [], `wave ${f.wave}`);
});

test("wave 0 decides every held sample map and nothing else (owner, 2026-10-08)", () => {
  const held = SAMPLE.entries.filter((e) => e.verdict !== "ready").map((e) => e.id).sort();
  const decided = DECISION_FILES.find((f) => f.wave === 0)!.decisions.map((d) => d.id).sort();
  assert.equal(held.length, 23);
  assert.deepEqual(decided, held);
});

test("the five maps that aren't usable stay hidden; the other 18 are approved", () => {
  const w0 = ofWave(0);
  const hidden = w0.filter((d) => d.decision === "hidden").map((d) => d.id).sort();
  assert.deepEqual(hidden, ["10227416", "232293", "234628", "255303", "274721"]);
  assert.equal(w0.filter((d) => d.decision === "approved").length, 18);
});

test("wave 1 (owner, 2026-10-08): every map that needs a decision has one; usable ones approved, the rest hidden", () => {
  const looks = first01.looks as Record<string, { call: string }>;
  const w1 = new Map(ofWave(1).map((d) => [d.id, d.decision]));
  const needs = manifest(1).filter((e) => e.verdict !== "ready" || ["hold", "unsure"].includes(looks[e.id].call));
  assert.equal(needs.length, 56);
  assert.deepEqual([...w1.keys()].sort(), needs.map((e) => e.id).sort());
  for (const e of needs) assert.equal(w1.get(e.id), ["good", "usable"].includes(looks[e.id].call) ? "approved" : "hidden", e.id);
  assert.equal([...w1.values()].filter((d) => d === "approved").length, 31);
});

test("RECORDED holds every wave's decisions, each map once", () => {
  assert.equal(Object.keys(RECORDED).length, DECISION_FILES.reduce((n, f) => n + f.decisions.length, 0));
});

test("decisionProblems names each fault", () => {
  const bad: DecisionFile = { version: 2 as 1, wave: 9, source: "", decisions: [
    { id: "nope", decision: "approved", by: "x", on: "2026-10-08", note: "" },
    { id: "232471", decision: "maybe" as never, by: "", on: "Oct 8", note: "" },
    { id: "232471", decision: "hidden", by: "x", on: "2026-10-08", note: "" },
  ] };
  assert.deepEqual(decisionProblems(bad, sampleIds), [
    "version 2 (expected 1)",
    "no source (who decided, and how)",
    "nope: not a map in this wave",
    "232471: unknown decision \"maybe\"",
    "232471: no \"by\"",
    "232471: \"on\" is not a date",
    "232471: decided twice",
  ]);
});

test("the downloaded file keeps a recorded decision's record, dates a new one, and drops other waves' maps", () => {
  const ids = ["233595", "274721", "232471"];
  const { file, problems } = decisionsFileFor(0, ids, { "233595": "approved", "274721": "approved", "232471": "approved", "999": "approved" }, "2026-10-09");
  assert.deepEqual(problems, []);
  assert.deepEqual(file.decisions.map((d) => d.id), ids);
  assert.equal(file.decisions[0].on, "2026-10-08");
  assert.equal(file.decisions[0].by, "Owner");
  // Changed on the page (recorded hidden, now approved): a new record, dated today.
  assert.deepEqual(file.decisions[1], { id: "274721", decision: "approved", by: "Owner (review page)", on: "2026-10-09", note: "" });
  assert.equal(file.decisions[2].on, "2026-10-08");
  assert.match(file.source, /3 decisions on wave 0/);
});

test("the first offer for a held map follows what held it: spread or stacked → hidden, anything else → roads", () => {
  // Wave 1, 2026-10-08: Cave Spring's E and F loops have no roads, though every check passed; the
  // page called it "not one campground's map". A hold with no spread-out or stacked reason is roads.
  assert.equal(suggestedDecision([], "hold"), "roads");
  assert.equal(suggestedDecision([{ code: "unplaced" }], "hold"), "roads");
  assert.equal(suggestedDecision([{ code: "far-from-roads" }, { code: "traced" }], "hold"), "roads");
  assert.equal(suggestedDecision([{ code: "unplaced" }, { code: "spread" }], "hold"), "hidden");
  assert.equal(suggestedDecision([{ code: "stacked" }], "hold"), "hidden");
  assert.equal(suggestedDecision([{ code: "outlier" }, { code: "far-from-roads" }], "hold"), "hidden");
  for (const look of ["good", "usable", "unsure", undefined]) assert.equal(suggestedDecision([{ code: "spread" }], look), "approved");
});
