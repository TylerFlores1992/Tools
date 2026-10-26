import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadProgress } from "@/lib/learn/store";
import { requirePrivate } from "@/lib/money/guard";
import { lessonById, PHASES, quizzesOf } from "@/tools/learn/lessons";
import { lessonStatus, phaseOpen } from "@/tools/learn/progress";
import { LearnNotConfigured, LearnShell, LearnUnreachable } from "@/tools/learn/ui/LearnShell";
import { LessonPlayer } from "@/tools/learn/ui/LessonPlayer";
import { State } from "@/components/State";
import { startOver } from "../actions";

type Params = { params: Promise<{ lesson: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const l = lessonById((await params).lesson);
  return { title: l ? `${l.number} ${l.title}` : "Lesson", robots: { index: false, follow: false } };
}

export default async function LessonPage({ params }: Params) {
  const { lesson: id } = await params;
  await requirePrivate(`/private/learn/${encodeURIComponent(id)}`);
  const lesson = lessonById(id);
  if (!lesson) notFound();

  const data = await loadProgress();
  if (data.state !== "ok") {
    return (
      <LearnShell current={null} crumb={`${lesson.number} ${lesson.title}`}>
        {data.state === "not-configured" ? <LearnNotConfigured /> : <LearnUnreachable />}
      </LearnShell>
    );
  }

  // A quiz lives with its lesson: same phase, same lock.
  const parentId = lesson.quizOf ?? id;
  const parent = lessonById(parentId);
  const pi = PHASES.findIndex((p) => p.lessons.some((l) => l.id === parentId));
  const open = phaseOpen(PHASES, pi, data.lessons);
  const status = lessonStatus(lesson, data.lessons.get(id));
  const startAt = status.kind === "started" ? status.step : 0;
  const quizzes = quizzesOf(parentId).map((q) => ({ id: q.id, label: `Quiz ${q.number.split("Quiz ")[1]}: ${q.title}`, done: lessonStatus(q, data.lessons.get(q.id)).kind === "done" }));
  // A quiz's number already says "1.2 · Quiz 1".
  const kind = lesson.quizOf ? "" : lesson.checkpoint ? "Checkpoint " : "Lesson ";

  return (
    <LearnShell current={null} crumb={`${lesson.number} ${lesson.title}`}>
      <div className="max-w-[760px]">
        <p className="font-mono text-label uppercase text-muted">
          {kind}{lesson.number} · about {lesson.minutes} min
        </p>
        <h1 className="mt-3 text-title font-normal">{lesson.quizOf && parent ? `${parent.title}: ${lesson.title.toLowerCase()}` : lesson.title}</h1>
        <p className="mt-3 text-lede text-ink-2">{lesson.goal}</p>
        {!open && (
          <p className="mt-4 text-small">
            <State kind="note">This phase opens once the phase before it is passed. You can look around, but finish that one first.</State>
          </p>
        )}
        {status.kind === "started" && status.step > 0 && (
          <form action={startOver} className="mt-4 flex flex-wrap items-center gap-3 text-small text-muted">
            <span>Picking up at step {status.step + 1}.</span>
            <input type="hidden" name="lesson" value={id} />
            <button type="submit" className="min-h-11 underline underline-offset-4 hover:text-ink">Start from the beginning</button>
          </form>
        )}
        {status.kind === "done" && <p className="mt-4 text-small"><State kind={status.passed ? "ok" : "note"}>{status.passed ? "Done before. Going through again counts as review." : "Not passed yet. Going again is the way."}</State></p>}
      </div>
      <div className="mt-8">
        <LessonPlayer key={`${id}-${startAt}`} lesson={lesson} startAt={startAt} quizzes={quizzes} />
      </div>
    </LearnShell>
  );
}
