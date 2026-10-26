import { checkpointPassed, SOLID_BOX } from "./check";
import type { Lesson, Phase } from "./types";

/** What the Learn home shows, worked out from the saved rows. Pure: tested in learn.test.mts. */

export type LessonState = { lessonId: string; lastStep: number; completedAt: string | null; score: number | null; outOf: number | null };
export type ItemState = { itemId: string; lessonId: string; box: number; dueOn: string };

export type LessonStatus =
  | { kind: "new" }
  | { kind: "started"; step: number }
  | { kind: "done"; score: number | null; outOf: number | null; passed: boolean };

export function lessonStatus(lesson: Lesson, row: LessonState | undefined): LessonStatus {
  if (!row) return { kind: "new" };
  if (row.completedAt) {
    const passed = !lesson.checkpoint || (row.score != null && row.outOf != null && checkpointPassed(row.score, row.outOf));
    return { kind: "done", score: row.score, outOf: row.outOf, passed };
  }
  return { kind: "started", step: row.lastStep };
}

/** A phase is open when the phase before it has a passed checkpoint (or no checkpoint and every lesson done). */
export function phaseOpen(phases: readonly Phase[], index: number, rows: ReadonlyMap<string, LessonState>): boolean {
  if (index === 0) return true;
  const prev = phases[index - 1];
  if (!prev.lessons.length) return false;
  return prev.lessons.every((l) => {
    const s = lessonStatus(l, rows.get(l.id));
    return s.kind === "done" && s.passed;
  });
}

/** The lesson to do next: one in progress first, else the first not done (or not passed) in an open phase. */
export function nextLesson(phases: readonly Phase[], rows: ReadonlyMap<string, LessonState>): Lesson | null {
  for (let p = 0; p < phases.length; p++) {
    if (!phaseOpen(phases, p, rows)) break;
    for (const l of phases[p].lessons) if (lessonStatus(l, rows.get(l.id)).kind === "started") return l;
  }
  for (let p = 0; p < phases.length; p++) {
    if (!phaseOpen(phases, p, rows)) break;
    for (const l of phases[p].lessons) {
      const s = lessonStatus(l, rows.get(l.id));
      if (s.kind !== "done" || !s.passed) return l;
    }
  }
  return null;
}

/** Items due today or earlier, for lessons that still exist (a lesson renamed away leaves old rows behind). */
export function dueItems(items: readonly ItemState[], today: string, known: (lessonId: string, itemId: string) => boolean): ItemState[] {
  return items.filter((i) => i.dueOn <= today && known(i.lessonId, i.itemId)).sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));
}

export const solidCount = (items: readonly ItemState[]) => items.filter((i) => i.box >= SOLID_BOX).length;

/** The last seven days (oldest first) and whether you studied on each. */
export function week(today: string, studyDays: readonly string[]): { date: string; studied: boolean }[] {
  const set = new Set(studyDays);
  const out: { date: string; studied: boolean }[] = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - k);
    const date = d.toISOString().slice(0, 10);
    out.push({ date, studied: set.has(date) });
  }
  return out;
}

/** The soonest date anything comes back, after today. */
export function nextDue(items: readonly ItemState[], today: string): string | null {
  const later = items.map((i) => i.dueOn).filter((d) => d > today).sort();
  return later[0] ?? null;
}
