"use client";

import { Button, LinkButton, Arrow } from "@/components/Button";
import { State } from "@/components/State";
import { cx } from "@/components/cx";
import { LETTERS, PRACTICE_SETS, type Question } from "./questions";
import { useStored } from "./stored";

type Answers = Record<string, number>;
const NONE: Answers = {};
const isAnswers = (v: unknown): v is Answers =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.values(v).every((n) => Number.isInteger(n) && n >= 0 && n <= 3);

export function PracticeTest({ slug }: { slug: "a" | "b" }) {
  const set = PRACTICE_SETS.find((s) => s.slug === slug)!;
  const other = PRACTICE_SETS.find((s) => s.slug !== slug)!;
  const [answers, setAnswers] = useStored(`etcp:practice:${slug}`, NONE, isAnswers);
  const qs = set.questions;
  const done = qs.filter((q) => answers[q.id] !== undefined).length;
  const right = qs.filter((q) => answers[q.id] === q.answer).length;
  const pct = Math.round((right / qs.length) * 100);

  function answer(q: Question, i: number) {
    if (answers[q.id] !== undefined) return;
    setAnswers({ ...answers, [q.id]: i });
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-bg px-5 py-3 sm:-mx-12 sm:px-12">
        <div className="flex max-w-[760px] items-center gap-4 text-small tabular-nums">
          <span className="text-ink">{done} of {qs.length} answered</span>
          <span className="text-muted">{right} right</span>
          <div role="progressbar" aria-label="Answered" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={done} className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${(done / qs.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <ol className="max-w-[760px]">
        {qs.map((q, n) => (
          <QuestionItem key={q.id} q={q} n={n + 1} chosen={answers[q.id]} onAnswer={(i) => answer(q, i)} />
        ))}
      </ol>

      <div className="mt-10 max-w-[760px]" aria-live="polite">
        {done === qs.length && (
          <div className="rounded-card border border-line bg-surface p-6 shadow-card">
            <p className="font-mono text-label uppercase text-muted">Your score</p>
            <p className="mt-2 text-title font-normal tabular-nums leading-none">
              {right} <span className="text-ink-2">of {qs.length}</span>
            </p>
            <p className="mt-2 text-body text-ink-2">
              {pct}% · {pct >= 80 ? "Solid. Try the other test, or work back through the ones you missed." : "Go back over the ✕ answers and their working, then start over."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href={`/workshop/etcp-rigger-study/practice/${other.slug}`}>
                {other.name} <Arrow />
              </LinkButton>
              <Button variant="quiet" onClick={() => { setAnswers(NONE); window.scrollTo({ top: 0 }); }}>Start over</Button>
            </div>
          </div>
        )}
        {done > 0 && done < qs.length && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            <p className="text-small text-muted">Progress is saved in this browser only.</p>
            <Button variant="ghost" onClick={() => { setAnswers(NONE); window.scrollTo({ top: 0 }); }}>Start over</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionItem({ q, n, chosen, onAnswer }: { q: Question; n: number; chosen: number | undefined; onAnswer: (i: number) => void }) {
  const answered = chosen !== undefined;
  const correct = chosen === q.answer;
  return (
    <li id={q.id} className="scroll-mt-20 border-b border-line py-8">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:gap-x-4">
        <span aria-hidden="true" className="pt-1 font-mono text-label tabular-nums text-muted">{String(n).padStart(2, "0")}</span>
        <div>
          <p className="font-mono text-label uppercase text-muted">
            <span className="sr-only">Question {n}, </span>
            {q.topic}
          </p>
          <p id={`${q.id}-stem`} className="mt-2 text-lede text-ink">{q.stem}</p>
          <div role="group" aria-labelledby={`${q.id}-stem`} className="mt-5 grid gap-2.5">
            {q.options.map((o, i) => {
              const isKey = i === q.answer, isChosen = i === chosen;
              return (
                <button
                  key={i}
                  type="button"
                  aria-disabled={answered || undefined}
                  onClick={() => onAnswer(i)}
                  className={cx(
                    "flex min-h-12 w-full items-start gap-3 rounded-input border bg-surface px-4 py-3 text-left text-body transition-colors duration-150",
                    !answered && "border-control hover:border-ink-2 hover:bg-surface-2",
                    answered && "cursor-default",
                    answered && isKey && "border-ice",
                    answered && isChosen && !isKey && "border-wrong",
                    answered && !isKey && !isChosen && "border-line text-ink-2",
                  )}
                >
                  <span aria-hidden="true" className="mt-px flex size-6 shrink-0 items-center justify-center rounded-tag border border-line-2 font-mono text-label">{LETTERS[i]}</span>
                  <span className="sr-only">{LETTERS[i]}. </span>
                  <span className="min-w-0 flex-1">
                    {o}
                    {answered && isKey && (
                      <span className="mt-1 block text-small"><State kind="ok">{isChosen ? "Your answer · correct" : "Correct answer"}</State></span>
                    )}
                    {answered && isChosen && !isKey && <span className="mt-1 block text-small"><State kind="wrong">Your answer</State></span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div aria-live="polite">
            {answered && (
              <div className="mt-4 rounded-card border border-line bg-surface-2 p-4 sm:p-5">
                {correct ? (
                  <State kind="ok" className="font-medium">Correct</State>
                ) : (
                  <State kind="wrong" className="font-medium">Not quite. The answer is {LETTERS[q.answer]}.</State>
                )}
                <p className="mt-2 text-body text-ink-2">{q.explain}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
