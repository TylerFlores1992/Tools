import assert from "node:assert/strict";
import test from "node:test";
import { DECISION_FILES, RECORDED, decisionProblems, type DecisionFile } from "./decisions.ts";
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
  const bad: DecisionFile = { version: 1, wave: 9, source: "", decisions: [
    { id: "nope", decision: "approved", by: "x", on: "2026-10-08", note: "" },
    { id: "232471", decision: "maybe" as never, by: "", on: "Oct 8", note: "" },
    { id: "232471", decision: "hidden", by: "x", on: "2026-10-08", note: "" },
  ] };
  assert.deepEqual(decisionProblems(bad, sampleIds), [
    "no source (who decided, and how)",
    "nope: not a map in this wave",
    "232471: unknown decision \"maybe\"",
    "232471: no \"by\"",
    "232471: \"on\" is not a date",
    "232471: decided twice",
  ]);
});
