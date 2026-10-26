"use server";

import { revalidatePath } from "next/cache";
import { requirePrivate } from "@/lib/money/guard";
import { markExplanation } from "@/lib/learn/ai";
import { recordAttempt, restartLesson, saveLessonStep } from "@/lib/learn/store";
import { MAX_ANSWER, type Grade } from "@/tools/learn/grade";
import { findStep, lessonById } from "@/tools/learn/lessons";
import { itemId } from "@/tools/learn/types";

/** Every action re-checks the Private session; the proxy is the first lock, not the only one. */

export type Saved = { saved: boolean };
type Source = "lesson" | "review";
const src = (s: unknown): Source => (s === "review" ? "review" : "lesson");

export async function answerStep(input: { lessonId: string; stepId: string; correct: boolean; answer: string | null; first: boolean; source: Source }): Promise<Saved> {
  await requirePrivate("/private/learn");
  const step = findStep(input.lessonId, input.stepId);
  if (!step || step.kind === "learn") return { saved: false };
  try {
    await recordAttempt({
      itemId: itemId(input.lessonId, input.stepId),
      lessonId: input.lessonId,
      kind: step.kind,
      correct: Boolean(input.correct),
      answer: input.answer == null ? null : String(input.answer).slice(0, MAX_ANSWER),
      feedback: null,
      source: src(input.source),
      first: Boolean(input.first),
    });
    return { saved: true };
  } catch (e) {
    console.error("learn save failed", e instanceof Error ? e.name : "unknown");
    return { saved: false };
  }
}

export type MarkResult = { state: "marked"; grade: Grade; saved: boolean } | { state: "unavailable" };

/** The AI marks an explanation against the step's rubric (taken from the lesson here, never from the page). */
export async function markExplain(input: { lessonId: string; stepId: string; answer: string; first: boolean; source: Source }): Promise<MarkResult> {
  await requirePrivate("/private/learn");
  const step = findStep(input.lessonId, input.stepId);
  const answer = String(input.answer ?? "").trim().slice(0, MAX_ANSWER);
  if (!step || step.kind !== "explain" || answer.length < 3) return { state: "unavailable" };
  const grade = await markExplanation(step, answer);
  if (!grade) return { state: "unavailable" };
  let saved = true;
  try {
    await recordAttempt({ itemId: itemId(input.lessonId, input.stepId), lessonId: input.lessonId, kind: "explain", correct: grade.passed, answer, feedback: grade, source: src(input.source), first: Boolean(input.first) });
  } catch (e) {
    console.error("learn save failed", e instanceof Error ? e.name : "unknown");
    saved = false;
  }
  return { state: "marked", grade, saved };
}

export async function saveStep(lessonId: string, step: number): Promise<Saved> {
  await requirePrivate("/private/learn");
  const lesson = lessonById(lessonId);
  if (!lesson || !Number.isInteger(step) || step < 0 || step >= lesson.steps.length) return { saved: false };
  try {
    await saveLessonStep(lessonId, step, null);
    return { saved: true };
  } catch {
    return { saved: false };
  }
}

export async function finishLesson(lessonId: string, score: number, outOf: number): Promise<Saved> {
  await requirePrivate("/private/learn");
  const lesson = lessonById(lessonId);
  if (!lesson || !Number.isInteger(score) || !Number.isInteger(outOf) || score < 0 || score > outOf) return { saved: false };
  try {
    await saveLessonStep(lessonId, lesson.steps.length - 1, { score, outOf });
    revalidatePath("/private/learn");
    return { saved: true };
  } catch {
    return { saved: false };
  }
}

export async function startOver(form: FormData): Promise<void> {
  await requirePrivate("/private/learn");
  const id = String(form.get("lesson") ?? "");
  if (!lessonById(id)) return;
  await restartLesson(id);
  revalidatePath(`/private/learn/${id}`);
}
