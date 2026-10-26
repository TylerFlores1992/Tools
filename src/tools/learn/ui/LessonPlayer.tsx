"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow, Button, buttonClasses } from "@/components/Button";
import { State } from "@/components/State";
import { answerStep, finishLesson, saveStep } from "@/app/private/learn/actions";
import { checkpointPassed, CHECKPOINT_PASS } from "../check";
import { isGraded, type Lesson, type Step } from "../types";
import { kindLabel, StepView, type Report } from "./Steps";

/**
 * Plays one lesson a step at a time. Opens where you left off (saved per step, so a phone and a
 * computer agree). Continue unlocks once a step is answered; Back is always there to reread.
 */
export type QuizLink = { id: string; label: string; done: boolean };

export function LessonPlayer({ lesson, startAt, quizzes = [] }: { lesson: Lesson; startAt: number; quizzes?: readonly QuizLink[] }) {
  const steps = lesson.steps;
  const graded = steps.filter(isGraded).length;
  const [i, setI] = useState(Math.min(Math.max(0, startAt), steps.length - 1));
  const [done, setDone] = useState<Set<number>>(() => new Set(steps.map((s, n) => (n < startAt || s.kind === "learn" ? n : -1)).filter((n) => n >= 0)));
  // First-try results this sitting. Steps passed before a resume aren't rescored.
  const [firsts, setFirsts] = useState<Map<string, boolean>>(new Map());
  const [finished, setFinished] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [announce, setAnnounce] = useState("");
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLParagraphElement>(null);
  const step: Step = steps[i];

  // On a new step, bring its top into view and move focus to it, so keyboard and screen-reader
  // users start at the new step (not on first load: the lesson header stays in view).
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    top.current?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    heading.current?.focus({ preventScroll: true });
  }, [i, finished]);

  // Answered already: anything before where this sitting started (answered on an earlier visit),
  // and anything answered since. Reopened with Back, a step can be answered again but isn't scored
  // or moved through the review boxes a second time.
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(steps.slice(0, startAt).map((s) => s.id)));
  const seenRef = useRef(seen);
  const report: Report = ({ correct, answer, first: firstTry, recorded }) => {
    const first = firstTry && !seenRef.current.has(step.id);
    if (first) {
      seenRef.current = new Set(seenRef.current).add(step.id);
      setSeen(seenRef.current);
      setFirsts((m) => new Map(m).set(step.id, correct));
    }
    setAnnounce(correct ? "Right." : "Not right. The explanation is below.");
    if (recorded) return;
    answerStep({ lessonId: lesson.id, stepId: step.id, correct, answer, first, source: "lesson" })
      .then((r) => !r.saved && setUnsaved(true))
      .catch(() => setUnsaved(true));
  };

  // Saved place = the furthest step reached, so stepping Back to reread doesn't move it back.
  const furthest = useRef(i);
  const go = (n: number) => {
    setI(n);
    setAnnounce("");
    if (n > furthest.current) {
      furthest.current = n;
      saveStep(lesson.id, n).catch(() => setUnsaved(true));
    }
  };
  const score = [...firsts.values()].filter(Boolean).length;
  const scored = firsts.size;
  const next = () => {
    if (i < steps.length - 1) go(i + 1);
    else {
      setFinished(true);
      finishLesson(lesson.id, score, scored)
        .then((r) => !r.saved && setUnsaved(true))
        .catch(() => setUnsaved(true));
    }
  };

  if (finished) {
    const full = scored === graded;
    const pass = !lesson.checkpoint || (full && checkpointPassed(score, scored));
    return (
      <div ref={top} className="max-w-[720px] scroll-mt-4">
        <h2 className="font-mono text-label uppercase text-muted">{lesson.quizOf ? "" : lesson.checkpoint ? "Checkpoint " : "Lesson "}{lesson.number} done</h2>
        <div className="mt-4 rounded-card border border-line bg-surface p-6 shadow-card">
          <p className="font-mono text-label uppercase text-muted">Right on the first try</p>
          <p className="mt-2 text-title font-normal tabular-nums leading-none">
            {score} <span className="text-ink-2">of {scored}</span>
          </p>
          {!full && <p className="mt-2 text-small text-muted">Steps you did before picking this up again aren&rsquo;t counted, so this run doesn&rsquo;t replace your score.</p>}
          <div className="mt-4 text-body">
            {lesson.checkpoint ? (
              pass ? (
                <State kind="ok">Checkpoint passed. The next phase is open.</State>
              ) : (
                <State kind="wrong">
                  {full ? `Not passed yet: it needs ${Math.round(CHECKPOINT_PASS * 100)}% on the first try. Review this phase, then try it again tomorrow.` : "A checkpoint only counts when done in one go. Start it from the beginning to take it."}
                </State>
              )
            ) : (
              <p className="text-ink-2">Everything you missed comes back in tomorrow&rsquo;s review. The ones you got right come back later, so they stick.</p>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/private/learn" className={buttonClasses("primary")}>
              Back to Learn <Arrow />
            </Link>
            <Link href="/private/learn/review" className={buttonClasses("quiet")}>Review</Link>
          </div>
        </div>
        {quizzes.some((q) => q.id !== lesson.id) && (
          <section aria-labelledby="practice-quizzes" className="mt-8">
            <h3 id="practice-quizzes" className="font-mono text-label uppercase text-muted">{lesson.quizOf ? "The other quizzes for this lesson" : "Practice quizzes for this lesson"}</h3>
            <p className="mt-2 text-small text-ink-2">Four questions each. The first right away; the others later today or tomorrow work best.</p>
            <ul className="mt-3 grid gap-2">
              {quizzes
                .filter((q) => q.id !== lesson.id)
                .map((q) => (
                  <li key={q.id}>
                    <Link href={`/private/learn/${q.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-input border border-line bg-surface px-4 py-2 text-body text-ink transition-colors duration-150 hover:border-control hover:bg-surface-2">
                      <span>{q.label}</span>
                      {q.done ? <State kind="ok" className="text-small">Done</State> : <span className="text-small text-muted">Not taken</span>}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        )}
        {unsaved && <Unsaved />}
      </div>
    );
  }

  const canGo = done.has(i);
  return (
    <div ref={top} className="scroll-mt-4">
      <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-bg px-5 py-3 sm:-mx-12 sm:px-12">
        <div className="flex max-w-[960px] items-center gap-4 text-small tabular-nums">
          <span className="whitespace-nowrap text-ink">Step {i + 1} of {steps.length}</span>
          <span className="hidden whitespace-nowrap text-muted sm:inline">{lesson.number} {lesson.title}</span>
          <div role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={i + 1} className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-8 max-w-[960px]">
        <p ref={heading} tabIndex={-1} className="font-mono text-label uppercase text-muted">
          <span className="sr-only">Step {i + 1} of {steps.length}: </span>
          {kindLabel(step.kind)}
        </p>
        <p className="sr-only" aria-live="polite">{announce}</p>
        <div className="mt-3" key={step.id}>
          <StepView step={step} lessonId={lesson.id} source="lesson" answeredBefore={seen.has(step.id)} report={report} onDone={() => setDone((d) => new Set(d).add(i))} />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <Button variant="ghost" onClick={() => go(i - 1)} disabled={i === 0}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {!canGo && <span className="text-small text-muted">Answer to continue</span>}
            <Button onClick={next} disabled={!canGo}>
              {i === steps.length - 1 ? "Finish" : "Continue"} <Arrow />
            </Button>
          </div>
        </div>
        {unsaved && <Unsaved />}
      </div>
    </div>
  );
}

export function Unsaved() {
  return (
    <p className="mt-4 text-small">
      <State kind="wrong">Some answers didn&rsquo;t save. Check your connection; your place in the lesson may not carry to other devices.</State>
    </p>
  );
}
