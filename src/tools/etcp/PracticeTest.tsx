"use client";

import { Button, LinkButton, Arrow } from "@/components/Button";
import { State } from "@/components/State";
import { cx } from "@/components/cx";
import { AREAS, LETTERS, PRACTICE_SETS, type Area, type Question } from "./questions";
import { usePracticeAnswers, type Answers } from "./stored";
import { STUDY_BASE } from "./nav";

export function PracticeTest({ slug }: { slug: string }) {
  const at = PRACTICE_SETS.findIndex((s) => s.slug === slug);
  const set = PRACTICE_SETS[at];
  const other = PRACTICE_SETS[(at + 1) % PRACTICE_SETS.length];
  const [answers, setAnswers, NONE] = usePracticeAnswers(slug);
  const qs = set.questions;
  const done = qs.filter((q) => answers[q.id] !== undefined).length;
  const right = qs.filter((q) => answers[q.id] === q.answer).length;
  const wrong = done - right;
  const pct = Math.round((right / qs.length) * 100);
  const startOver = () => { setAnswers(NONE); window.scrollTo({ top: 0 }); };

  function answer(q: Question, i: number) {
    if (answers[q.id] !== undefined) return;
    setAnswers({ ...answers, [q.id]: i });
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,760px)_15rem] lg:items-start lg:gap-16 xl:gap-24">
      <div className="min-w-0">
        {/* Full-bleed background on phones; the hairline stops at the column. */}
        <div className="sticky top-0 z-10 -mx-5 bg-bg px-5 sm:-mx-12 sm:px-12 lg:mx-0 lg:px-0">
          <div className="flex max-w-[760px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3 text-small tabular-nums">
            <span className="text-ink">{done} of {qs.length} answered</span>
            <span className="flex gap-3 text-muted">
              <span><span aria-hidden="true" className="text-ice">✓</span> {right} right</span>
              <span><span aria-hidden="true" className="text-wrong">✕</span> {wrong} wrong</span>
            </span>
            <div role="progressbar" aria-label="Answered" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={done} aria-valuetext={`${done} of ${qs.length} answered`} className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${(done / qs.length) * 100}%` }} />
            </div>
          </div>
        </div>

        <ol className="max-w-[760px]">
          {qs.map((q, n) => (
            <QuestionItem key={q.id} q={q} n={n + 1} chosen={answers[q.id]} onAnswer={(i) => answer(q, i)} />
          ))}
        </ol>

        <div className="max-w-[760px]" aria-live="polite">
          {done === qs.length && (
            <div className="mt-10 rounded-card border border-line bg-surface p-6 shadow-card">
              <p className="font-mono text-label uppercase text-muted">Your score</p>
              <p className="mt-2 text-title font-normal tabular-nums leading-none">
                {right} <span className="text-ink-2">of {qs.length}</span>
              </p>
              <p className="mt-2 text-body text-ink-2">
                {pct}% · {pct >= 80 ? "Solid. Try another test, or work back through the ones you missed." : "Go back over the ✕ answers and their working, then start over."}
              </p>
              <AreaScores qs={qs} answers={answers} />
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href={`${STUDY_BASE}/practice/${other.slug}`}>
                  Next: {other.name} <Arrow />
                </LinkButton>
                <LinkButton variant="quiet" href={STUDY_BASE}>Back to overview</LinkButton>
                <Button variant="ghost" onClick={startOver}>Start over</Button>
              </div>
            </div>
          )}
        </div>
        {done < qs.length && (
          <div className="mt-10 max-w-[760px] pt-2">
            <p className="text-body text-ink-2 tabular-nums">
              {done === 0
                ? `Nothing answered yet. Your score shows here once all ${qs.length} are done.`
                : `You’ve answered ${done} of ${qs.length} so far, ${qs.length - done} to go. Your score shows here once they’re all done.`}
            </p>
            <p className="mt-1 text-small text-muted">Progress is saved in this browser only.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton variant="quiet" href={`${STUDY_BASE}/practice/${other.slug}`}>
                Next: {other.name} <Arrow />
              </LinkButton>
              <LinkButton variant="ghost" href={STUDY_BASE}>Back to overview</LinkButton>
              {done > 0 && <Button variant="ghost" onClick={startOver}>Start over</Button>}
            </div>
          </div>
        )}
      </div>

      <QuestionIndex qs={qs} answers={answers} />
    </div>
  );
}

/** Desktop only: every question at a glance, ✓/✕ once answered, each a link to the question. */
function QuestionIndex({ qs, answers }: { qs: readonly Question[]; answers: Answers }) {
  return (
    <nav aria-label="Questions" className="hidden lg:sticky lg:top-6 lg:block">
      <p className="font-mono text-label uppercase text-muted">Questions</p>
      <ol className="mt-3 grid grid-cols-5 gap-1">
        {qs.map((q, i) => {
          const chosen = answers[q.id];
          const state = chosen === undefined ? "none" : chosen === q.answer ? "right" : "wrong";
          const n = String(i + 1).padStart(2, "0");
          return (
            <li key={q.id}>
              <a
                href={`#${q.id}`}
                aria-label={`Question ${i + 1}, ${state === "none" ? "not answered" : state === "right" ? "correct" : "incorrect"}`}
                className={cx(
                  "flex size-11 flex-col items-center justify-center rounded-tag border font-mono text-label leading-none tabular-nums tracking-normal transition-colors duration-150 hover:bg-surface-2",
                  state === "none" && "border-line-2 text-muted hover:text-ink",
                  state === "right" && "border-ice text-ink-2",
                  state === "wrong" && "border-wrong text-ink-2",
                )}
              >
                <span>{n}</span>
                {state !== "none" && (
                  <span aria-hidden="true" className={cx("mt-1", state === "right" ? "text-ice" : "text-wrong")}>
                    {state === "right" ? "✓" : "✕"}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Score per part of the content outline, so you know what to study. Only for sets tagged by area. */
function AreaScores({ qs, answers }: { qs: readonly Question[]; answers: Answers }) {
  const rows = (Object.keys(AREAS) as Area[])
    .map((a) => {
      const inArea = qs.filter((q) => q.area === a);
      return { a, total: inArea.length, right: inArea.filter((q) => answers[q.id] === q.answer).length };
    })
    .filter((r) => r.total > 0);
  if (!rows.length) return null;
  return (
    <table className="mt-6 w-full text-left text-small tabular-nums">
      <caption className="pb-2 text-left font-mono text-label uppercase text-muted">By part of the exam outline</caption>
      <thead className="sr-only">
        <tr><th scope="col">Part</th><th scope="col">Right</th><th scope="col">Score</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const p = Math.round((r.right / r.total) * 100);
          return (
            <tr key={r.a} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 font-normal text-ink">
                <span className="mr-2 font-mono text-label text-muted">{r.a}</span>
                {AREAS[r.a]}
              </th>
              <td className="py-2 pr-3 text-right text-ink-2 whitespace-nowrap">{r.right} of {r.total}</td>
              <td className="w-px py-2 text-right whitespace-nowrap">
                {p >= 80 ? <State kind="ok" sr={false}>{p}% · solid</State> : <State kind="note" sr={false}>{p}% · review</State>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
          <p id={`${q.id}-stem`} className="mt-2 whitespace-pre-line text-lede text-ink">{q.stem}</p>
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
                      <span className="mt-1 block text-small"><State kind="ok" sr={false}>{isChosen ? "Your answer · correct" : "Correct answer"}</State></span>
                    )}
                    {answered && isChosen && !isKey && <span className="mt-1 block text-small"><State kind="wrong" sr={false}>Your answer · incorrect</State></span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div aria-live="polite">
            {answered && (
              <div className="mt-4 rounded-card border border-line bg-surface-2 p-4 sm:p-5">
                {correct ? (
                  <State kind="ok" sr={false} className="font-medium">Correct</State>
                ) : (
                  <State kind="wrong" sr="Incorrect:" className="font-medium">Not quite. The answer is {LETTERS[q.answer]}.</State>
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
