import "server-only";
import { sql, isConfigured } from "@/lib/money/db";
import { dueAfter, firstBox, nextBox, todayLA } from "@/tools/learn/check";

/**
 * Learning progress in the `learn` schema (docs/sql/learn-schema.sql), same database and role as
 * Money and Mail. One learner, so no user column. Reads run one at a time: Supabase's pooler
 * stalls pipelined queries (src/lib/money/db.ts).
 */

export type LessonRow = { lessonId: string; lastStep: number; completedAt: string | null; score: number | null; outOf: number | null };
export type ItemRow = { itemId: string; lessonId: string; box: number; dueOn: string; right: number; wrong: number };

export type Progress = {
  state: "ok";
  today: string;
  lessons: Map<string, LessonRow>;
  items: ItemRow[];
  /** YYYY-MM-DD days with any attempt in the last 28 days, newest first. */
  studyDays: string[];
};
export type ProgressPage = { state: "not-configured" } | { state: "unreachable" } | Progress;

export async function loadProgress(): Promise<ProgressPage> {
  if (!isConfigured()) return { state: "not-configured" };
  try {
    const db = sql();
    const lessons = await db<{ lesson_id: string; last_step: number; completed_at: Date | null; score: number | null; out_of: number | null }[]>`
      select lesson_id, last_step, completed_at, score, out_of from learn.lessons`;
    const items = await db<{ item_id: string; lesson_id: string; box: number; due_on: string; right_count: number; wrong_count: number }[]>`
      select item_id, lesson_id, box, to_char(due_on, 'YYYY-MM-DD') as due_on, right_count, wrong_count from learn.items`;
    const days = await db<{ d: string }[]>`
      select distinct to_char(created_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD') as d
      from learn.attempts where created_at > now() - interval '28 days' order by d desc`;
    return {
      state: "ok",
      today: todayLA(),
      lessons: new Map(lessons.map((l) => [l.lesson_id, { lessonId: l.lesson_id, lastStep: l.last_step, completedAt: l.completed_at?.toISOString() ?? null, score: l.score, outOf: l.out_of }])),
      items: items.map((i) => ({ itemId: i.item_id, lessonId: i.lesson_id, box: i.box, dueOn: i.due_on, right: i.right_count, wrong: i.wrong_count })),
      studyDays: days.map((d) => d.d),
    };
  } catch (e) {
    console.error("learn load failed", e instanceof Error ? e.name : "unknown");
    return { state: "unreachable" };
  }
}

/**
 * One answer. Every try is logged; only the FIRST try in a lesson (or any review answer) moves the
 * item through the review boxes, so retrying until right doesn't count as knowing it.
 */
export async function recordAttempt(a: {
  itemId: string;
  lessonId: string;
  kind: string;
  correct: boolean;
  answer: string | null;
  feedback: unknown;
  source: "lesson" | "review";
  first: boolean;
}): Promise<void> {
  const db = sql();
  const today = todayLA();
  await db`insert into learn.attempts (item_id, lesson_id, kind, correct, answer, feedback, source)
    values (${a.itemId}, ${a.lessonId}, ${a.kind}, ${a.correct}, ${a.answer?.slice(0, 4000) ?? null}, ${a.feedback == null ? null : db.json(a.feedback as never)}, ${a.source})`;
  if (!a.first) return;
  const [row] = await db<{ box: number }[]>`select box from learn.items where item_id = ${a.itemId}`;
  const box = row ? nextBox(row.box, a.correct) : firstBox(a.correct);
  const due = dueAfter(today, box);
  await db`insert into learn.items (item_id, lesson_id, box, due_on, right_count, wrong_count, last_seen_at)
    values (${a.itemId}, ${a.lessonId}, ${box}, ${due}, ${a.correct ? 1 : 0}, ${a.correct ? 0 : 1}, now())
    on conflict (item_id) do update set box = ${box}, due_on = ${due},
      right_count = learn.items.right_count + ${a.correct ? 1 : 0},
      wrong_count = learn.items.wrong_count + ${a.correct ? 0 : 1}, last_seen_at = now()`;
}

/** Where you are in a lesson, so it reopens there. Finishing records the first-try score. */
export async function saveLessonStep(lessonId: string, step: number, finished: { score: number; outOf: number } | null): Promise<void> {
  const db = sql();
  if (finished) {
    await db`insert into learn.lessons (lesson_id, last_step, completed_at, score, out_of, updated_at)
      values (${lessonId}, ${step}, now(), ${finished.score}, ${finished.outOf}, now())
      on conflict (lesson_id) do update set last_step = ${step}, completed_at = now(),
        score = greatest(coalesce(learn.lessons.score, 0), ${finished.score}), out_of = ${finished.outOf}, updated_at = now()`;
    return;
  }
  await db`insert into learn.lessons (lesson_id, last_step) values (${lessonId}, ${step})
    on conflict (lesson_id) do update set last_step = ${step}, updated_at = now()`;
}

/** Start a lesson over from the first step (keeps the review boxes and the best score). */
export async function restartLesson(lessonId: string): Promise<void> {
  await sql()`update learn.lessons set last_step = 0, updated_at = now() where lesson_id = ${lessonId}`;
}
