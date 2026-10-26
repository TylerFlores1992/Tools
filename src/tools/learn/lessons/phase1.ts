import type { Lesson, Phase } from "../types";
import { L1_1, L1_2, L1_3, L1_4, L1_5 } from "./phase1a";
import { L1_10, L1_11, L1_6, L1_7, L1_8, L1_9 } from "./phase1b";

/**
 * The Phase 1 checkpoint: new code (nothing copied from the lessons), every step type, no
 * reading steps. Passing needs CHECKPOINT_PASS on the first try (check.ts).
 */
const CHECKPOINT: Lesson = {
  id: "p1-checkpoint",
  number: "1.12",
  title: "Phase 1 checkpoint",
  goal: "Show you can read, trace and judge basic JavaScript and TypeScript without help.",
  minutes: 30,
  checkpoint: true,
  steps: [
    {
      kind: "predict",
      id: "c1",
      prompt: "No AI, no running it. What prints?",
      code: `let crew = 4;\nconst extra = "2";\ncrew = crew + 1;\nconsole.log(crew + extra);`,
      choices: ["7", "52", "6", "42"],
      answer: 1,
      why: "`crew` becomes 5. Then 5 + \"2\" has a string on one side, so it glues: \"52\".",
    },
    {
      kind: "trace",
      id: "c2",
      prompt: "Trace it. What are `a.length` and `n` at the end?",
      code: `const a = ["truss"];\nconst b = a;\nb.push("motor");\nlet n = a.length;\nn = n * 10;`,
      rows: [
        { label: "a.length", answer: "2" },
        { label: "n", answer: "20" },
      ],
      why: "`b` is a second name for the same array, so the push shows in `a`: length 2. Then `n` is 2 × 10 = 20.",
    },
    {
      kind: "predict",
      id: "c3",
      prompt: "What prints?",
      code: `const load = 650;\nif (load > 1000) {\n  console.log("Over");\n} else if (load > 500) {\n  console.log("Check");\n} else if (load > 100) {\n  console.log("OK");\n}`,
      choices: ["Over", "Check", "OK", "Check\nOK"],
      answer: 1,
      why: "650 isn't over 1000; it is over 500, so \"Check\" prints and the chain stops.",
    },
    {
      kind: "bug",
      id: "c4",
      prompt: "This should print every motor, but the last line printed is `undefined`. Which line is the bug?",
      code: `const motors = ["M1", "M2", "M3"];\nfor (let i = 0; i <= motors.length; i++) {\n  console.log(motors[i]);\n}`,
      line: 2,
      why: "`<=` runs one round too many and reads `motors[3]`. It should be `i < motors.length`.",
    },
    {
      kind: "trace",
      id: "c5",
      prompt: "What do these hold?",
      code: `const pts = [{ w: 300 }, { w: 1200 }, { w: 800 }];\nconst heavy = pts.filter((p) => p.w >= 800).length;\nconst first = pts.find((p) => p.w > 2000);`,
      rows: [
        { label: "heavy", answer: "2" },
        { label: "first", answer: "undefined" },
      ],
      why: "1200 and 800 are at least 800: 2. Nothing is over 2000, and `find` with no match gives `undefined`.",
    },
    {
      kind: "predict",
      id: "c6",
      prompt: "What prints?",
      code: `function total(xs) {\n  let t = 0;\n  for (const x of xs) {\n    t = t + x;\n  }\n}\nconsole.log(total([1, 2, 3]));`,
      choices: ["6", "0", "undefined", "[1, 2, 3]"],
      answer: 2,
      why: "The function adds them up but never returns `t`, so the call gives back `undefined`.",
    },
    {
      kind: "parsons",
      id: "c7",
      prompt: "Build a function that returns the ids of open sites. One line doesn't belong.",
      lines: ["function openIds(sites) {", "  return sites", "    .filter((s) => s.open)", "    .map((s) => s.id);", "}"],
      distractors: ["    .find((s) => s.open)"],
      why: "Keep the open ones with `filter`, then turn each into its id with `map`. `find` would give a single site, not a list.",
    },
    {
      kind: "bug",
      id: "c8",
      prompt: "Which line would TypeScript flag?",
      code: `interface Point {\n  name: string;\n  load: number;\n}\nconst p: Point = { name: "DSL 1", load: 750 };\np.load = "800";`,
      line: 6,
      why: "`load` is a number, and `\"800\"` is a string.",
    },
    {
      kind: "compare",
      id: "c9",
      prompt: "Both should say whether the bridle is over the hoist's limit. Which is right?",
      a: `function overLimit(load: number, limit: number): boolean {\n  if (load = limit) {\n    return true;\n  }\n  return load > limit;\n}`,
      b: `function overLimit(load: number, limit: number): boolean {\n  return load > limit;\n}`,
      answer: "b",
      why: "A's `if (load = limit)` assigns instead of comparing, so it returns `true` whenever the limit isn't 0. TypeScript doesn't catch this one: it's valid code, just wrong. B is correct and simpler.",
    },
    {
      kind: "predict",
      id: "c10",
      prompt: "What does this print?",
      code: `const w = { site: "C2" };\nconst x = { ...w };\nx.site = "D4";\nconsole.log(w.site);`,
      choices: ["C2", "D4", "undefined", "An error"],
      answer: 0,
      why: "`{ ...w }` makes a new object with the same properties, so changing `x.site` leaves `w` alone. (It copies only the top level: an object or array nested inside would still be shared.)",
    },
    {
      kind: "bug",
      id: "c11",
      prompt: "This should count bookings of 3 or more nights but always gives 0. Which line?",
      code: `const stays = [2, 3, 5, 1];\nlet long = 0;\nfor (const n of stays) {\n  let long = 0;\n  if (n >= 3) long = long + 1;\n}\nconsole.log(long);`,
      line: 4,
      why: "Line 4 makes a new `long` inside the loop, reset every round, and it hides the outer one. The outer `long` is never touched, so it prints 0.",
    },
    {
      kind: "explain",
      id: "c12",
      prompt: "Explain what this function is for, what `nextOpen(sites)` gives back when nothing is open, and one way a caller could trip on that.",
      code: `function nextOpen(sites: { id: string; open: boolean }[]) {\n  return sites.find((s) => s.open);\n}`,
      rubric: ["Purpose: gets the first open site from the list", "When nothing is open it gives back undefined", "A caller that uses the result straight away (e.g. reads .id) would crash, so it should check for undefined first"],
      model: "It returns the first open site. If none are open, `find` gives `undefined`, so a caller doing `nextOpen(sites).id` would crash with \"Cannot read properties of undefined\". The caller should check the result before using it.",
    },
  ],
};

export const PHASE_1: Phase = {
  id: "basics",
  number: 1,
  title: "JavaScript and TypeScript basics",
  weeks: "Weeks 1–3",
  summary: "Read a program line by line: variables, types, decisions, lists, objects, functions, loops, list tools and TypeScript types, ending on code shaped like CampHawk's.",
  lessons: [L1_1, L1_2, L1_3, L1_4, L1_5, L1_6, L1_7, L1_8, L1_9, L1_10, L1_11, CHECKPOINT],
};
