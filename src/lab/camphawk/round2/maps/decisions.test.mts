import assert from "node:assert/strict";
import test from "node:test";
import { DECISION_FILES, RECORDED, decisionProblems, decisionsFileFor, suggestedDecision, type DecisionFile } from "./decisions.ts";
import { SAMPLE } from "./sample.ts";

const sampleIds = new Set(SAMPLE.entries.map((e) => e.id));

test("every recorded decision is for a map in its wave and is well formed", () => {
  for (const f of DECISION_FILES) assert.deepEqual(decisionProblems(f, sampleIds), [], `wave ${f.wave}`);
});

test("wave 0 decides every held sample map and nothing else (owner, 2026-10-08)", () => {
  const held = SAMPLE.entries.filter((e) => e.verdict !== "ready").map((e) => e.id).sort();
  const decided = DECISION_FILES.find((f) => f.wave === 0)!.decisions.map((d) => d.id).sort();
  assert.equal(held.length, 23);
  assert.deepEqual(decided, held);
});

test("the five maps that aren't usable stay hidden; the other 18 are approved", () => {
  const hidden = Object.values(RECORDED).filter((d) => d.decision === "hidden").map((d) => d.id).sort();
  assert.deepEqual(hidden, ["10227416", "232293", "234628", "255303", "274721"]);
  assert.equal(Object.values(RECORDED).filter((d) => d.decision === "approved").length, 18);
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
