/** Marking for each step type, and the review schedule. Pure: tested in learn.test.mts. */

/** A typed value as a person would mean it: spaces trimmed and squeezed, outer quotes optional. */
export function normalizeValue(v: string): string {
  const t = v.trim().replace(/\s+/g, " ");
  const q = /^(['"`])(.*)\1$/.exec(t);
  return q ? q[2] : t;
}

/** Arrays and lists typed loosely: spaces and quote marks don't matter, so ["C2"], ['C2'] and [C2] agree. */
const loose = (v: string) => v.replace(/[\s'"`]/g, "");

export function traceRowRight(typed: string, row: { answer: string; accept?: readonly string[] }): boolean {
  const n = normalizeValue(typed);
  if (!n) return false;
  const answers = [row.answer, ...(row.accept ?? [])];
  if (answers.some((a) => normalizeValue(a) === n)) return true;
  // Loose matching only for list answers: for a single value, "Upper Pines" and "UpperPines" differ.
  return n.startsWith("[") && answers.some((a) => a.trim().startsWith("[") && loose(a) === loose(n));
}

export function parsonsRight(placed: readonly string[], lines: readonly string[]): boolean {
  return placed.length === lines.length && placed.every((l, i) => l.trim() === lines[i].trim());
}

/** Output lines must match exactly, after trimming each line's ends. Extra blank lines at the end don't count. */
export function outputMatches(got: readonly string[], expect: readonly string[]): boolean {
  const clean = (xs: readonly string[]) => {
    const out = xs.map((x) => x.trimEnd());
    while (out.length && out[out.length - 1].trim() === "") out.pop();
    return out;
  };
  const g = clean(got);
  const e = clean(expect);
  return g.length === e.length && g.every((l, i) => l.trim() === e[i].trim());
}

/**
 * The review queue: a Leitner system with five boxes. Right moves an item up a box, wrong sends it
 * back to box 1. The gap before it comes back grows with the box (days). Why: spaced retrieval
 * beats rereading; see /private/learn/method.
 */
// 1/3/7/14/30: Leitner's boxes, capped near 4 weeks for a 12-week goal (Cepeda 2008: the best gap
// is a fraction of how long you need to remember).
export const BOX_DAYS: readonly number[] = [1, 3, 7, 14, 30];
export const MAX_BOX = BOX_DAYS.length;
/** An item in this box or higher counts as "solid". */
export const SOLID_BOX = 4;

export function nextBox(box: number, correct: boolean): number {
  if (!correct) return 1;
  return Math.min(MAX_BOX, Math.max(1, box) + 1);
}

/** `today` as YYYY-MM-DD; returns the date `box`'s gap later. */
export function dueAfter(today: string, box: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + BOX_DAYS[Math.min(MAX_BOX, Math.max(1, box)) - 1]);
  return d.toISOString().slice(0, 10);
}

/** The first time an item is seen in a lesson: right starts it in box 2, wrong in box 1. */
export const firstBox = (correct: boolean) => (correct ? 2 : 1);

/** Share of first tries a checkpoint needs. Mastery programs work best with a high bar (Kulik: 90%+). */
export const CHECKPOINT_PASS = 0.9;
export const checkpointPassed = (right: number, outOf: number) => outOf > 0 && right / outOf >= CHECKPOINT_PASS;

/** Today in the owner's time zone, as YYYY-MM-DD. */
export function todayLA(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Shuffle that is the same every time for the same seed (so a page and its rerender agree). */
export function seededShuffle<T>(xs: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Most review items in one sitting (load stays light enough to do daily). */
export const REVIEW_PER_DAY = 15;

/**
 * Mix a review queue so no more than two in a row come from the same lesson (interleaving), keeping
 * the given order otherwise. If it can't (one lesson left), the rest go at the end as they are.
 */
export function interleave<T>(xs: readonly T[], group: (x: T) => string, maxRun = 2): T[] {
  const left = [...xs];
  const out: T[] = [];
  while (left.length) {
    const g = out.length >= maxRun ? group(out[out.length - 1]) : null;
    const run = g != null && out.slice(-maxRun).every((x) => group(x) === g);
    const k = run ? left.findIndex((x) => group(x) !== g) : 0;
    out.push(...left.splice(k === -1 ? 0 : k, 1));
  }
  return out;
}
