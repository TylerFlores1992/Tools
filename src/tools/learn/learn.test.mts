import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { BOX_DAYS, checkpointPassed, dueAfter, firstBox, interleave, nextBox, normalizeValue, outputMatches, parsonsRight, seededShuffle, todayLA, traceRowRight } from "./check.ts";
import { readGrade } from "./grade.ts";
import { ALL_LESSONS, ALL_QUIZZES, PHASES, findStep, lessonById, phaseOf, quizzesOf } from "./lessons/index.ts";

/** Lessons and their practice quizzes: every answer key gets the same checks. */
const EVERY = [...ALL_LESSONS, ...ALL_QUIZZES];
import { dueItems, lessonStatus, nextLesson, phaseOpen, week, type LessonState } from "./progress.ts";
import type { Lesson } from "./types.ts";

/* ───────── marking ───────── */

test("trace answers: quotes and spaces don't matter, case does", () => {
  assert.equal(normalizeValue('  "Upper  Pines" '), "Upper Pines");
  assert.ok(traceRowRight("'105'", { answer: '"105"' }));
  assert.ok(traceRowRight("105", { answer: '"105"' }));
  assert.ok(!traceRowRight("wawona", { answer: "Wawona" }));
  assert.ok(!traceRowRight("", { answer: "0" }));
  assert.ok(traceRowRight("[C2]", { answer: '["C2"]' }));
  assert.ok(traceRowRight("['A1', 'C2']", { answer: '["A1", "C2"]' }));
  assert.ok(!traceRowRight("[C2, A1]", { answer: '["A1", "C2"]' }), "order matters in a list");
  assert.ok(!traceRowRight("UpperPines", { answer: "Upper Pines" }), "loose matching is for lists only");
  assert.ok(!traceRowRight("105", { answer: '"105"', quoted: true }), "a quoted row needs the quotes");
  assert.ok(traceRowRight("'105'", { answer: '"105"', quoted: true }));
});

test("parsons: order and content must match", () => {
  assert.ok(parsonsRight(["a", " b "], ["a", "b"]));
  assert.ok(!parsonsRight(["b", "a"], ["a", "b"]));
  assert.ok(!parsonsRight(["a"], ["a", "b"]));
});

test("run output: lines must match, trailing blank lines ignored", () => {
  assert.ok(outputMatches(["6", ""], ["6"]));
  assert.ok(!outputMatches(["6", "7"], ["6"]));
  assert.ok(!outputMatches([], ["6"]));
});

/* ───────── review boxes ───────── */

test("leitner: right moves up one box, wrong goes back to 1, capped at 5", () => {
  assert.equal(nextBox(1, true), 2);
  assert.equal(nextBox(4, true), 5);
  assert.equal(nextBox(5, true), 5);
  assert.equal(nextBox(4, false), 1);
  assert.equal(firstBox(true), 2);
  assert.equal(firstBox(false), 1);
});

test("due dates follow the box gaps and cross month ends", () => {
  assert.deepEqual(BOX_DAYS, [1, 3, 7, 14, 30]);
  assert.equal(dueAfter("2026-10-26", 1), "2026-10-27");
  assert.equal(dueAfter("2026-10-26", 5), "2026-11-25");
  assert.equal(dueAfter("2026-12-31", 2), "2027-01-03");
});

test("checkpoint needs 90% on the first try", () => {
  assert.ok(checkpointPassed(11, 12));
  assert.ok(!checkpointPassed(10, 12));
  assert.ok(!checkpointPassed(0, 0));
});

test("today is the Pacific date", () => {
  assert.equal(todayLA(new Date("2026-10-27T06:30:00Z")), "2026-10-26");
});

test("interleave: never three in a row from one lesson when it can be avoided", () => {
  const xs = ["a", "a", "a", "a", "b", "b", "c"].map((g, i) => ({ g, i }));
  const out = interleave(xs, (x) => x.g);
  assert.equal(out.length, xs.length);
  for (let i = 2; i < out.length - 1; i++) assert.ok(!(out[i].g === out[i - 1].g && out[i].g === out[i - 2].g), `run of three at ${i}`);
  assert.deepEqual(new Set(out.map((x) => x.i)), new Set(xs.map((x) => x.i)));
});

test("seeded shuffle is stable for a seed and keeps every item", () => {
  const xs = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(seededShuffle(xs, "s"), seededShuffle(xs, "s"));
  assert.deepEqual([...seededShuffle(xs, "s")].sort(), xs);
});

/* ───────── progress ───────── */

const row = (lessonId: string, p: Partial<LessonState> = {}): LessonState => ({ lessonId, lastStep: 0, completedAt: null, score: null, outOf: null, ...p });

test("lesson status and the next lesson", () => {
  const [l1, l2] = PHASES[0].lessons;
  const rows = new Map<string, LessonState>();
  assert.equal(nextLesson(PHASES, rows)?.id, l1.id);
  rows.set(l1.id, row(l1.id, { completedAt: "2026-10-26T10:00:00Z", score: 5, outOf: 6 }));
  assert.equal(lessonStatus(l1, rows.get(l1.id)).kind, "done");
  assert.equal(nextLesson(PHASES, rows)?.id, l2.id);
  rows.set(l2.id, row(l2.id, { lastStep: 3 }));
  assert.deepEqual(lessonStatus(l2, rows.get(l2.id)), { kind: "started", step: 3 });
});

test("phase 2 opens only after phase 1's checkpoint is passed", () => {
  const rows = new Map<string, LessonState>();
  const done = (l: Lesson, score: number, outOf: number) => rows.set(l.id, row(l.id, { completedAt: "2026-10-26T10:00:00Z", score, outOf }));
  const n = (l: Lesson) => l.steps.filter((s) => s.kind !== "learn").length;
  for (const l of PHASES[0].lessons) done(l, n(l), n(l));
  assert.ok(phaseOpen(PHASES, 1, rows));
  const cp = PHASES[0].lessons.find((l) => l.checkpoint)!;
  done(cp, 1, 1);
  assert.ok(!phaseOpen(PHASES, 1, rows), "a checkpoint finished after a resume (1 of 1) doesn't pass");
  done(cp, n(cp) - 4, n(cp));
  assert.ok(!phaseOpen(PHASES, 1, rows), "a failed checkpoint keeps the next phase shut");
  assert.equal(nextLesson(PHASES, rows)?.id, cp.id, "and sends you back to it");
});

test("due items: today and earlier, oldest first, unknown steps dropped", () => {
  const items = [
    { itemId: "p1-reading/order", lessonId: "p1-reading", box: 1, dueOn: "2026-10-26" },
    { itemId: "p1-reading/quotes", lessonId: "p1-reading", box: 2, dueOn: "2026-10-20" },
    { itemId: "p1-reading/gone", lessonId: "p1-reading", box: 2, dueOn: "2026-10-20" },
    { itemId: "p1-reading/bug", lessonId: "p1-reading", box: 3, dueOn: "2026-10-30" },
  ];
  const known = (l: string, i: string) => Boolean(findStep(l, i.slice(l.length + 1)));
  assert.deepEqual(dueItems(items, "2026-10-26", known).map((i) => i.itemId), ["p1-reading/quotes", "p1-reading/order"]);
});

test("week: seven days ending today", () => {
  const w = week("2026-10-26", ["2026-10-26", "2026-10-22", "2026-10-01"]);
  assert.equal(w.length, 7);
  assert.equal(w[0].date, "2026-10-20");
  assert.equal(w.filter((d) => d.studied).length, 2);
});

/* ───────── AI marking ───────── */

test("AI reply is lined up with the rubric whatever length it comes back", () => {
  const step = ALL_LESSONS.flatMap((l) => l.steps).find((s) => s.kind === "explain")!;
  if (step.kind !== "explain") throw new Error();
  const short = readGrade(step, { points: [{ met: true, note: "" }], feedback: "Good start." });
  assert.equal(short.points.length, step.rubric.length);
  assert.ok(!short.passed);
  const all = readGrade(step, { points: step.rubric.map(() => ({ met: true, note: "" })).concat([{ met: false, note: "extra" }]), feedback: "ok" });
  assert.ok(all.passed);
  assert.equal(all.points.length, step.rubric.length);
});

/* ───────── the lessons themselves ───────── */

test("lesson and step ids are unique and URL-safe", () => {
  const ids = EVERY.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of EVERY) {
    assert.match(l.id, /^[a-z0-9-]+$/);
    const s = l.steps.map((x) => x.id);
    assert.equal(new Set(s).size, s.length, `${l.id}: duplicate step id`);
    for (const id of s) assert.match(id, /^[a-z0-9-]+$/, `${l.id}/${id}`);
  }
});

test("every step's answer points at something that exists", () => {
  for (const l of EVERY) {
    for (const s of l.steps) {
      const where = `${l.id}/${s.id}`;
      if (s.kind === "predict") {
        assert.ok(s.answer >= 0 && s.answer < s.choices.length, where);
        assert.equal(new Set(s.choices).size, s.choices.length, `${where}: duplicate choice`);
      }
      if (s.kind === "bug") assert.ok(s.line >= 1 && s.line <= s.code.split("\n").length, where);
      if (s.kind === "parsons") {
        assert.ok(s.lines.length >= 3, where);
        for (const d of s.distractors ?? []) assert.ok(!s.lines.includes(d), `${where}: a distractor is also a real line`);
      }
      if (s.kind === "trace") assert.ok(s.rows.length > 0, where);
      if (s.kind === "explain") assert.ok(s.rubric.length >= 2 && s.model.length > 20, where);
      if (s.kind === "learn" && s.code && s.notes) for (const n of s.notes) assert.ok(n.from >= 1 && n.to <= s.code.split("\n").length && n.from <= n.to, `${where}: note lines`);
    }
  }
});

test("every lesson after the first opens with a warm-up, and every lesson has an explain step", () => {
  for (const l of ALL_LESSONS) {
    assert.ok(l.steps.some((s) => s.kind === "explain"), `${l.id}: no explain step`);
  }
  const ordinary = ALL_LESSONS.filter((l) => !l.checkpoint && l.id !== "p1-reading" && l.id !== "p1-real-code");
  for (const l of ordinary) assert.equal(l.steps[0].id, "warmup", `${l.id}: first step should be the warm-up`);
});

/** Runs JS the way the browser worker does (src/tools/learn/run.ts) and returns the printed lines. */
function run(code: string): { lines: string[]; error: string | null } {
  const lines: string[] = [];
  const fmt = (v: unknown) => (typeof v === "string" ? v : v === undefined ? "undefined" : JSON.stringify(v));
  const out = (...a: unknown[]) => lines.push(a.map(fmt).join(" "));
  try {
    vm.runInNewContext(code, { console: { log: out, info: out, warn: out, error: out } }, { timeout: 1000 });
    return { lines, error: null };
  } catch (e) {
    return { lines, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

test("every Run step: the solution prints what's expected, and the starter doesn't", () => {
  for (const l of EVERY) {
    for (const s of l.steps) {
      if (s.kind !== "run") continue;
      const sol = run(`${s.solution}\n${s.after ?? ""}`);
      assert.equal(sol.error, null, `${l.id}/${s.id}: solution throws`);
      assert.ok(outputMatches(sol.lines, s.expect), `${l.id}/${s.id}: solution prints ${JSON.stringify(sol.lines)}`);
      const start = run(`${s.starter}\n${s.after ?? ""}`);
      assert.ok(start.error !== null || !outputMatches(start.lines, s.expect), `${l.id}/${s.id}: the starter already passes`);
    }
  }
});

test("predict steps whose code is plain JavaScript: the answer is what really prints", () => {
  // Only steps whose answer is the printed output; skip TypeScript and conceptual ones.
  let checked = 0;
  for (const l of EVERY) {
    for (const s of l.steps) {
      if (s.kind !== "predict" || !s.code || !s.code.includes("console.log") || /^How many/.test(s.prompt) || /:\s*(number|string|boolean|Watch|any)\b|interface /.test(s.code)) continue;
      const r = run(s.code);
      const printed = r.error ? "An error" : r.lines.join("\n");
      const want = s.choices[s.answer];
      if (want === "An error") assert.notEqual(r.error, null, `${l.id}/${s.id}`);
      else assert.equal(printed, want, `${l.id}/${s.id}: really prints ${JSON.stringify(printed)}`);
      checked++;
    }
  }
  assert.ok(checked >= 15, `only ${checked} predict steps checked`);
});

test("trace steps in plain JavaScript: the table matches the real values", () => {
  let checked = 0;
  for (const l of EVERY) {
    for (const s of l.steps) {
      if (s.kind !== "trace" || /:\s*(number|string|boolean)\b|interface |matchingSites/.test(s.code)) continue;
      // Turn const/let at the top level into globals we can read back.
      const code = s.code.replace(/^(const|let) /gm, "var ");
      const ctx: Record<string, unknown> = { console: { log: () => {} } };
      vm.runInNewContext(code, ctx, { timeout: 1000 });
      for (const r of s.rows) {
        const v = vm.runInNewContext(r.label, ctx);
        const shown = typeof v === "string" ? JSON.stringify(v) : Array.isArray(v) ? JSON.stringify(v) : String(v);
        assert.ok(traceRowRight(shown, r) || traceRowRight(String(v), r), `${l.id}/${s.id}: ${r.label} is really ${shown}`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 10, `only ${checked} trace steps checked`);
});

test("bug and compare steps with plain JavaScript: the buggy code really misbehaves", () => {
  // The checkpoint's loop bug: prints undefined last.
  const loop = run(`const motors = ["M1", "M2", "M3"];\nfor (let i = 0; i <= motors.length; i++) {\n  console.log(motors[i]);\n}`);
  assert.equal(loop.lines.at(-1), "undefined");
  // 1.9: braces without return keep nothing.
  assert.deepEqual(run(`const sites = [{ open: true }, { open: false }, { open: true }];\nconst open = sites.filter((s) => { s.open; });\nconsole.log(open.length);`).lines, ["0"]);
  // 1.11: comparing with undefined drops everything.
  assert.deepEqual(run(`console.log(40 >= undefined);`).lines, ["false"]);
  // 1.4: = in an if assigns 0, so "Open" every time (the step's code, run as written).
  const l14 = findStep("p1-decisions", "bug");
  assert.ok(l14 && l14.kind === "bug");
  assert.deepEqual(run(l14.code.replace("let sitesLeft = 7", "let sitesLeft = 0")).lines, ["Open"]);
  // 1.2: const reassignment throws.
  assert.match(run(`const nights = 2;\nnights = 3;`).error ?? "", /TypeError: Assignment to constant variable/);
});

test("practice quizzes: three per lesson (not the checkpoint), four tap-friendly questions each", () => {
  for (const l of ALL_LESSONS) {
    const qs = quizzesOf(l.id);
    if (l.checkpoint) {
      assert.equal(qs.length, 0, `${l.id}: a checkpoint is its own quiz`);
      continue;
    }
    assert.equal(qs.length, 3, `${l.id}: needs three quizzes`);
    qs.forEach((q, i) => {
      assert.equal(q.id, `${l.id}--quiz-${i + 1}`);
      assert.equal(q.quizOf, l.id);
      assert.equal(q.steps.length, 4, `${q.id}: four questions`);
      for (const s of q.steps) assert.ok(s.kind !== "learn" && s.kind !== "run" && s.kind !== "explain", `${q.id}/${s.id}: quizzes are tap-and-type only`);
      assert.equal(lessonById(q.id), q, "a quiz opens by its id like a lesson");
      assert.equal(phaseOf(q.id), phaseOf(l.id), "and belongs to its lesson's phase");
    });
  }
  // Quizzes are extra practice, not steps on the course path.
  assert.ok(!PHASES.some((p) => p.lessons.some((l) => l.quizOf)));
});
