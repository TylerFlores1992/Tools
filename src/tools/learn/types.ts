/**
 * Lessons for learning to READ code (trace it, predict it, find the bug, explain it), not to
 * write it from a blank page. Every lesson is plain data; the player renders it and the checks in
 * check.ts mark it. Why each step type exists, with sources: /private/learn/method.
 */

/** A worked example: code + what it does, read before anything is asked. */
export type LearnStep = {
  kind: "learn";
  id: string;
  title: string;
  /** Short paragraphs. `inline code` in backticks. Blank line = new paragraph. */
  body: string;
  code?: string;
  /** Subgoal labels: what a group of lines is FOR. Line numbers are 1-based, inclusive. */
  notes?: readonly { from: number; to: number; text: string }[];
};

/** Predict the output (or a value) before seeing it. Tap one choice: works on a phone. */
export type PredictStep = {
  kind: "predict";
  id: string;
  prompt: string;
  code?: string;
  choices: readonly string[];
  answer: number;
  why: string;
};

/** A tracing table: the value of each variable at a point. Type a short answer per row. */
export type TraceStep = {
  kind: "trace";
  id: string;
  prompt: string;
  code: string;
  /** `quoted`: a string answer must be typed with its quotes (when telling strings from numbers is the point). */
  rows: readonly { label: string; answer: string; accept?: readonly string[]; quoted?: boolean }[];
  why: string;
};

/** Put scrambled lines back in order (a Parsons problem). Tap to place: works on a phone. */
export type ParsonsStep = {
  kind: "parsons";
  id: string;
  prompt: string;
  /** In the correct order. Shown shuffled. */
  lines: readonly string[];
  /** Lines that don't belong. */
  distractors?: readonly string[];
  why: string;
};

/** Tap the line with the bug. */
export type BugStep = {
  kind: "bug";
  id: string;
  prompt: string;
  code: string;
  /** 1-based. */
  line: number;
  why: string;
};

/** Two solutions to one task: pick the better one. The gig's core task. */
export type CompareStep = {
  kind: "compare";
  id: string;
  prompt: string;
  a: string;
  b: string;
  answer: "a" | "b";
  why: string;
};

/** Explain in plain English. Marked against the rubric by the AI, or by you when it's unavailable. */
export type ExplainStep = {
  kind: "explain";
  id: string;
  prompt: string;
  code?: string;
  /** What a good answer must say. Shown after you answer, and given to the AI marker. */
  rubric: readonly string[];
  model: string;
};

/** Change code and run it in the browser until its output matches. Easiest on a computer. */
export type RunStep = {
  kind: "run";
  id: string;
  prompt: string;
  starter: string;
  /** Lines the program must print, in order (console.log). */
  expect: readonly string[];
  /** Hidden code run after yours (e.g. calls that print results). */
  after?: string;
  hint: string;
  solution: string;
};

export type Step = LearnStep | PredictStep | TraceStep | ParsonsStep | BugStep | CompareStep | ExplainStep | RunStep;
export type StepKind = Step["kind"];

/** Steps that can be marked right or wrong, and so go into the review queue. */
export type GradedStep = Exclude<Step, LearnStep>;

export type Lesson = {
  id: string;
  /** e.g. "1.2". */
  number: string;
  title: string;
  /** One line: what you'll be able to do after. */
  goal: string;
  minutes: number;
  /** Set on a practice quiz: the lesson it belongs to (src/tools/learn/lessons/phase1-quizzes.ts). */
  quizOf?: string;
  /** A checkpoint must be passed (CHECKPOINT_PASS first-try) before the phase counts as done. */
  checkpoint?: boolean;
  steps: readonly Step[];
};

export type Phase = {
  id: string;
  number: number;
  title: string;
  weeks: string;
  summary: string;
  lessons: readonly Lesson[];
};

export const isGraded = (s: Step): s is GradedStep => s.kind !== "learn";
export const itemId = (lessonId: string, stepId: string) => `${lessonId}/${stepId}`;
