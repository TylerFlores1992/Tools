"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { cx } from "@/components/cx";
import { State } from "@/components/State";
import { markExplain } from "@/app/private/learn/actions";
import { outputMatches, parsonsRight, seededShuffle, traceRowRight } from "../check";
import type { Grade } from "../grade";
import { runCode, type RunResult } from "../run";
import type { BugStep, CompareStep, ExplainStep, LearnStep, ParsonsStep, PredictStep, RunStep, Step, TraceStep } from "../types";
import { CodeBlock, Prose, inline, tokens } from "./Code";

/**
 * One component per step type. Each tells the player two things through `report`:
 * whether the FIRST try was right (that's what the review boxes use) and that the step is
 * finished, so Continue unlocks. Retrying until right is allowed and encouraged, but only the
 * first try is scored.
 */

/** `recorded`: the server already saved this answer (the AI marker does), so only score it. */
export type Report = (r: { correct: boolean; answer: string | null; first: boolean; recorded?: boolean }) => void;
/** `answeredBefore`: this step's first answer already counted (earlier visit, or before Back). */
export type StepProps<S extends Step> = { step: S; lessonId: string; source: "lesson" | "review"; report: Report; onDone: () => void; answeredBefore?: boolean };

const KIND_LABEL: Record<Step["kind"], string> = {
  learn: "Read",
  predict: "Predict",
  trace: "Trace",
  parsons: "Put in order",
  bug: "Find the bug",
  compare: "Compare",
  explain: "Explain",
  run: "Run it",
};
export const kindLabel = (k: Step["kind"]) => KIND_LABEL[k];

function Prompt({ children }: { children: ReactNode }) {
  return <p className="text-lede text-ink">{children}</p>;
}

function Why({ ok, title, children }: { ok: boolean; title: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-5 rounded-card border border-line bg-surface p-4 sm:p-5" aria-live="polite">
      <State kind={ok ? "ok" : "wrong"} className="font-medium">{title}</State>
      <div className="mt-2 text-body text-ink-2">{children}</div>
    </div>
  );
}

/**
 * "I'm guessing": a lucky guess isn't knowing, so a right answer with this ticked counts as a miss
 * for the review boxes and comes back tomorrow.
 */
function Guessing({ on, set, locked }: { on: boolean; set: (v: boolean) => void; locked: boolean }) {
  return (
    <label className="mt-4 inline-flex min-h-11 items-center gap-3 text-small text-ink-2">
      <input type="checkbox" checked={on} disabled={locked} onChange={(e) => set(e.target.checked)} className="size-5 accent-ink" />
      I&rsquo;m guessing
    </label>
  );
}

const guessNote = (right: boolean, guessed: boolean) => (right && guessed ? " It counts as a miss because you were guessing, so it comes back tomorrow." : "");

const choiceClasses = (chosen: boolean, right: boolean, answered: boolean) =>
  cx(
    "flex w-full min-h-12 items-start gap-3 rounded-input border px-4 py-3 text-left text-body transition-colors duration-150",
    !answered && "border-line-2 bg-surface hover:border-control hover:bg-surface-2",
    answered && right && "border-ice bg-surface",
    answered && chosen && !right && "border-wrong bg-surface",
    answered && !chosen && !right && "border-line bg-surface",
  );

/* ───────────── Read ───────────── */

export function LearnView({ step }: { step: LearnStep }) {
  return (
    <div>
      <h2 className="text-h2 font-normal">{step.title}</h2>
      <Prose text={step.body} className="mt-4 max-w-[68ch]" />
      {step.code && <CodeBlock code={step.code} notes={step.notes} className="mt-6" />}
    </div>
  );
}

/* ───────────── Predict ───────────── */

export function PredictView({ step, report, onDone }: StepProps<PredictStep>) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [guess, setGuess] = useState(false);
  const answered = chosen !== null;
  const pick = (i: number) => {
    if (answered) return;
    setChosen(i);
    report({ correct: i === step.answer && !guess, answer: step.choices[i], first: true });
    onDone();
  };
  return (
    <div>
      <Prompt>{inline(step.prompt)}</Prompt>
      {step.code && <CodeBlock code={step.code} className="mt-5" />}
      <Guessing on={guess} set={setGuess} locked={answered} />
      <div role="group" aria-label="Choices" className="mt-2 grid gap-2.5">
        {step.choices.map((c, i) => (
          <button key={i} type="button" onClick={() => pick(i)} aria-disabled={answered} className={choiceClasses(chosen === i, i === step.answer, answered)}>
            <span className="min-w-0 flex-1 whitespace-pre-wrap font-mono text-small text-ink">{c}</span>
            {answered && i === step.answer && <State kind="ok" className="text-small">{chosen === i ? "Your pick" : "Answer"}</State>}
            {answered && chosen === i && i !== step.answer && <State kind="wrong" className="text-small">Your pick</State>}
          </button>
        ))}
      </div>
      {answered && (
        <Why ok={chosen === step.answer} title={chosen === step.answer ? "Right" : "Not this time"}>
          <Prose text={step.why + guessNote(chosen === step.answer, guess)} />
        </Why>
      )}
    </div>
  );
}

/* ───────────── Find the bug ───────────── */

export function BugView({ step, report, onDone }: StepProps<BugStep>) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [guess, setGuess] = useState(false);
  const answered = chosen !== null;
  const lines = step.code.replace(/\n$/, "").split("\n");
  const pick = (n: number) => {
    if (answered) return;
    setChosen(n);
    report({ correct: n === step.line && !guess, answer: `line ${n}`, first: true });
    onDone();
  };
  return (
    <div>
      <Prompt>{inline(step.prompt)}</Prompt>
      <p className="mt-2 text-small text-muted">Tap the line.</p>
      <Guessing on={guess} set={setGuess} locked={answered} />
      <div role="group" aria-label="Lines of code" className="mt-2 overflow-hidden rounded-input border border-line bg-surface-2 py-2">
        {lines.map((l, i) => {
          const n = i + 1;
          const right = n === step.line;
          const mine = chosen === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              aria-disabled={answered}
              aria-label={`Line ${n}: ${l.trim() || "blank"}`}
              className={cx(
                "flex w-full min-h-11 items-center border-y border-transparent text-left font-mono text-small text-ink-2",
                !answered && "hover:border-line-2 hover:bg-surface",
                answered && right && "border-ice bg-surface",
                answered && mine && !right && "border-wrong bg-surface",
              )}
            >
              <span aria-hidden="true" className="w-10 shrink-0 pr-3 text-right tabular-nums text-muted">{n}</span>
              <span className="min-w-0 flex-1 overflow-x-auto whitespace-pre pr-3">{tokens(l)}</span>
              {answered && right && <State kind="ok" className="shrink-0 pr-3 font-sans text-small">Bug</State>}
              {answered && mine && !right && <State kind="wrong" className="shrink-0 pr-3 font-sans text-small">Your pick</State>}
            </button>
          );
        })}
      </div>
      {answered && (
        <Why ok={chosen === step.line} title={chosen === step.line ? "Found it" : `The bug is on line ${step.line}`}>
          <Prose text={step.why + guessNote(chosen === step.line, guess)} />
        </Why>
      )}
    </div>
  );
}

/* ───────────── Compare ───────────── */

export function CompareView({ step, report, onDone }: StepProps<CompareStep>) {
  const [chosen, setChosen] = useState<"a" | "b" | null>(null);
  const [guess, setGuess] = useState(false);
  const answered = chosen !== null;
  const pick = (c: "a" | "b") => {
    if (answered) return;
    setChosen(c);
    report({ correct: c === step.answer && !guess, answer: c.toUpperCase(), first: true });
    onDone();
  };
  return (
    <div>
      <Prompt>{inline(step.prompt)}</Prompt>
      <Guessing on={guess} set={setGuess} locked={answered} />
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {(["a", "b"] as const).map((c) => (
          <div key={c}>
            <CodeBlock code={step[c]} label={`Solution ${c.toUpperCase()}`} />
            <button type="button" onClick={() => pick(c)} aria-disabled={answered} className={cx(choiceClasses(chosen === c, c === step.answer, answered), "mt-2 justify-center")}>
              <span className="text-ink">Pick {c.toUpperCase()}</span>
              {answered && c === step.answer && <State kind="ok" className="text-small">Better</State>}
              {answered && chosen === c && c !== step.answer && <State kind="wrong" className="text-small">Your pick</State>}
            </button>
          </div>
        ))}
      </div>
      {answered && (
        <Why ok={chosen === step.answer} title={chosen === step.answer ? "Right call" : `${step.answer.toUpperCase()} is the better one`}>
          <Prose text={step.why + guessNote(chosen === step.answer, guess)} />
        </Why>
      )}
    </div>
  );
}

/* ───────────── Trace ───────────── */

export function TraceView({ step, report, onDone }: StepProps<TraceStep>) {
  const [vals, setVals] = useState<string[]>(() => step.rows.map(() => ""));
  const [checked, setChecked] = useState<boolean[] | null>(null);
  const [tries, setTries] = useState(0);
  const [shown, setShown] = useState(false);
  const allRight = checked?.every(Boolean) ?? false;
  const finished = allRight || shown;
  const check = () => {
    const marks = step.rows.map((r, i) => traceRowRight(vals[i], r));
    setChecked(marks);
    if (tries === 0) report({ correct: marks.every(Boolean), answer: step.rows.map((r, i) => `${r.label}=${vals[i]}`).join("; "), first: true });
    setTries((t) => t + 1);
    if (marks.every(Boolean)) onDone();
  };
  return (
    <div>
      <Prompt>{inline(step.prompt)}</Prompt>
      <CodeBlock code={step.code} className="mt-5" />
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!finished) check();
        }}
      >
        <table className="w-full max-w-[560px] text-left">
          <caption className="pb-2 text-left font-mono text-label uppercase text-muted">Your tracing table</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {step.rows.map((r, i) => (
              <tr key={r.label} className="border-t border-line">
                <th scope="row" className="py-2 pr-3 align-middle font-mono text-small font-normal text-ink">{r.label}</th>
                <td className="py-2">
                  <input
                    value={shown ? r.answer : vals[i]}
                    readOnly={finished}
                    onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                    aria-label={`Value of ${r.label}`}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="min-h-11 w-full rounded-input border border-control bg-surface px-3 font-mono text-small text-ink focus-visible:border-ink"
                  />
                </td>
                <td className="w-24 py-2 pl-3 text-small">
                  {checked && !shown && (checked[i] ? <State kind="ok">Right</State> : <State kind="wrong">Not yet</State>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!finished && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="submit">Check</Button>
            {tries >= 2 && (
              <Button
                variant="quiet"
                onClick={() => {
                  setShown(true);
                  onDone();
                }}
              >
                Show answers
              </Button>
            )}
          </div>
        )}
      </form>
      {finished && (
        <Why ok={allRight && tries === 1} title={allRight ? (tries === 1 ? "All right first time" : "Right now. Only the first try is scored.") : "Here's the trace"}>
          <Prose text={step.why} />
        </Why>
      )}
    </div>
  );
}

/* ───────────── Put in order ───────────── */

export function ParsonsView({ step, report, onDone }: StepProps<ParsonsStep>) {
  const pool0 = useMemo(() => seededShuffle([...step.lines, ...(step.distractors ?? [])].map((text, i) => ({ text, key: i })), step.id), [step]);
  const [placed, setPlaced] = useState<typeof pool0>([]);
  const [verdict, setVerdict] = useState<{ ok: boolean; prefix: number } | null>(null);
  const [tries, setTries] = useState(0);
  const [shown, setShown] = useState(false);
  const finished = verdict?.ok || shown;
  const pool = pool0.filter((p) => !placed.some((q) => q.key === p.key));
  const check = () => {
    const texts = placed.map((p) => p.text);
    const ok = parsonsRight(texts, step.lines);
    let prefix = 0;
    while (prefix < texts.length && prefix < step.lines.length && texts[prefix].trim() === step.lines[prefix].trim()) prefix++;
    setVerdict({ ok, prefix });
    if (tries === 0) report({ correct: ok, answer: texts.join("\n"), first: true });
    setTries((t) => t + 1);
    if (ok) onDone();
  };
  const lineBtn = "flex w-full min-h-11 items-center gap-3 rounded-btn border px-3 py-2 text-left font-mono text-small whitespace-pre";
  return (
    <div>
      <Prompt>{inline(step.prompt)}</Prompt>
      <p className="mt-2 text-small text-muted">
        Tap lines to build the program, top to bottom. Tap a placed line to send it back.{step.distractors?.length ? " Some lines don't belong." : ""}
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section aria-label="Your program">
          <p className="font-mono text-label uppercase text-muted">Your program</p>
          <ol className="mt-2 grid min-h-24 gap-2 rounded-input border border-dashed border-line-2 p-2">
            {(shown ? step.lines.map((text, key) => ({ text, key })) : placed).map((p, i) => (
              <li key={p.key}>
                <button
                  type="button"
                  disabled={finished}
                  aria-label={`Line ${i + 1}: ${p.text.trim()}${finished ? "" : ". Tap to take it out."}`}
                  onClick={() => {
                    setPlaced((xs) => xs.filter((x) => x.key !== p.key));
                    setVerdict(null);
                  }}
                  className={cx(lineBtn, "border-line-2 bg-surface text-ink disabled:opacity-100", !finished && "hover:border-control")}
                >
                  <span aria-hidden="true" className="w-5 shrink-0 text-right tabular-nums text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 overflow-x-auto">{tokens(p.text)}</span>
                </button>
              </li>
            ))}
            {!placed.length && !shown && <li className="px-2 py-3 text-small text-muted">Nothing yet.</li>}
          </ol>
        </section>
        {!finished && (
          <section aria-label="Lines to use">
            <p className="font-mono text-label uppercase text-muted">Lines</p>
            <ul className="mt-2 grid gap-2">
              {pool.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    aria-label={`Add line: ${p.text.trim()}`}
                    onClick={() => {
                      setPlaced((xs) => [...xs, p]);
                      setVerdict(null);
                    }}
                    className={cx(lineBtn, "border-line bg-surface-2 text-ink-2 hover:border-control hover:text-ink")}
                  >
                    <span className="min-w-0 flex-1 overflow-x-auto">{tokens(p.text)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {!finished && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={check} disabled={!placed.length}>Check</Button>
          {tries >= 2 && (
            <Button
              variant="quiet"
              onClick={() => {
                setShown(true);
                onDone();
              }}
            >
              Show answer
            </Button>
          )}
          {verdict && !verdict.ok && (
            <span aria-live="polite" className="text-small">
              <State kind="wrong">{verdict.prefix ? `The first ${verdict.prefix} ${verdict.prefix === 1 ? "line is" : "lines are"} right. Line ${verdict.prefix + 1} isn't.` : "The first line isn't right yet."}</State>
            </span>
          )}
        </div>
      )}
      {finished && (
        <Why ok={Boolean(verdict?.ok) && tries === 1} title={verdict?.ok ? (tries === 1 ? "In order, first time" : "In order now. Only the first try is scored.") : "Here's the order"}>
          <Prose text={step.why} />
        </Why>
      )}
    </div>
  );
}

/* ───────────── Run it ───────────── */

/** Tab indents (2 spaces) until Esc is pressed; after Esc, Tab moves on as usual (no keyboard trap). */
function onTab(e: KeyboardEvent<HTMLTextAreaElement>, set: (v: string) => void, indent: boolean, setIndent: (v: boolean) => void) {
  if (e.key === "Escape") {
    setIndent(false);
    return;
  }
  if (e.key !== "Tab" || e.shiftKey || !indent) return;
  e.preventDefault();
  const t = e.currentTarget;
  const { selectionStart: s, selectionEnd: end, value } = t;
  const next = `${value.slice(0, s)}  ${value.slice(end)}`;
  set(next);
  requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
}

export function RunView({ step, report, onDone }: StepProps<RunStep>) {
  const [code, setCode] = useState(step.starter);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState(0);
  const [ok, setOk] = useState(false);
  const [hint, setHint] = useState(false);
  const [shown, setShown] = useState(false);
  const [indent, setIndent] = useState(true);
  const run = async () => {
    setRunning(true);
    const r = await runCode(`${code}\n${step.after ?? ""}`);
    setRunning(false);
    setResult(r);
    const match = !r.error && outputMatches(r.lines, step.expect);
    if (runs === 0) report({ correct: match, answer: code, first: true });
    setRuns((n) => n + 1);
    if (match) {
      setOk(true);
      onDone();
    }
  };
  return (
    <div>
      <Prompt>{inline(step.prompt)}</Prompt>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <label htmlFor={`${step.id}-code`} className="font-mono text-label uppercase text-muted">Your code</label>
          <textarea
            id={`${step.id}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => onTab(e, setCode, indent, setIndent)}
            onFocus={() => setIndent(true)}
            aria-describedby={`${step.id}-keys`}
            rows={Math.max(6, code.split("\n").length + 1)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="mt-2 w-full resize-y rounded-input border border-control bg-surface-2 p-4 font-mono text-small leading-relaxed text-ink focus-visible:border-ink"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onClick={run} disabled={running}>{running ? "Running…" : "Run"}</Button>
            <Button variant="quiet" onClick={() => setCode(step.starter)}>Reset</Button>
            {runs >= 1 && !ok && !hint && <Button variant="ghost" onClick={() => setHint(true)}>Hint</Button>}
            {runs >= 2 && !ok && !shown && (
              <Button
                variant="ghost"
                onClick={() => {
                  setShown(true);
                  onDone();
                }}
              >
                Show a solution
              </Button>
            )}
          </div>
          <p id={`${step.id}-keys`} className="mt-2 text-small text-muted">Easiest on a computer. Tab indents; press Esc, then Tab, to move on. The code runs in your browser only.</p>
        </div>
        <div className="grid content-start gap-4">
          <div>
            <p className="font-mono text-label uppercase text-muted">Should print</p>
            <pre className="mt-2 overflow-x-auto rounded-input border border-line bg-surface p-3 font-mono text-small text-ink-2">{step.expect.join("\n")}</pre>
          </div>
          <div aria-live="polite">
            <p className="font-mono text-label uppercase text-muted">It printed</p>
            <pre className="mt-2 min-h-12 overflow-x-auto rounded-input border border-line bg-surface p-3 font-mono text-small text-ink">
              {result ? (result.lines.length ? result.lines.join("\n") : "(nothing)") : "Press Run."}
            </pre>
            {result?.error && <State kind="wrong" className="mt-2 text-small">{result.error}</State>}
            {result && !result.error && (ok ? <State kind="ok" className="mt-2 text-small">Matches</State> : <State kind="wrong" className="mt-2 text-small">Doesn&rsquo;t match yet</State>)}
          </div>
        </div>
      </div>
      {hint && !ok && (
        <div className="mt-4 rounded-card border border-line bg-surface p-4">
          <State kind="note">Hint</State>
          <Prose text={step.hint} className="mt-1" />
        </div>
      )}
      {(ok || shown) && (
        <Why ok={ok && runs === 1} title={ok ? (runs === 1 ? "Right on the first run" : "It works. Only the first run is scored.") : "One way to do it"}>
          <CodeBlock code={step.solution} label="A solution" />
        </Why>
      )}
    </div>
  );
}

/* ───────────── Explain ───────────── */

export function ExplainView({ step, lessonId, source, report, onDone, answeredBefore = false }: StepProps<ExplainStep>) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [tries, setTries] = useState(0);
  const [showModel, setShowModel] = useState(false);
  const [selfMark, setSelfMark] = useState(false);
  const [aiDown, setAiDown] = useState(false);
  const [ticks, setTicks] = useState<boolean[]>(() => step.rubric.map(() => false));
  const [selfDone, setSelfDone] = useState(false);
  const firstRef = useRef(!answeredBefore);
  // Feedback comes as hints first; the model answer only once every point is met or you ask for it
  // (an AI that hands over answers raises practice scores and lowers real ones: Bastani et al.).
  const passed = grade?.passed ?? false;
  const finished = passed || showModel || selfDone;

  const ask = async () => {
    setBusy(true);
    const r = await markExplain({ lessonId, stepId: step.id, answer: text, first: firstRef.current, source }).catch(() => ({ state: "unavailable" as const }));
    setBusy(false);
    if (r.state === "marked") {
      report({ correct: r.grade.passed, answer: text, first: firstRef.current, recorded: true });
      firstRef.current = false;
      setGrade(r.grade);
      setTries((t) => t + 1);
      if (r.grade.passed) onDone();
    } else {
      setAiDown(true);
      setSelfMark(true);
    }
  };
  const saveSelf = () => {
    report({ correct: ticks.every(Boolean), answer: text, first: firstRef.current });
    firstRef.current = false;
    setSelfDone(true);
    onDone();
  };

  return (
    <div>
      <Prompt>{inline(step.prompt)}</Prompt>
      {step.code && <CodeBlock code={step.code} className="mt-5" />}
      <label htmlFor={`${step.id}-text`} className="mt-5 block font-mono text-label uppercase text-muted">In your own words</label>
      <textarea
        id={`${step.id}-text`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={finished || busy}
        rows={5}
        maxLength={1500}
        placeholder="Say what it's for and what it does, as if to someone on the crew."
        className="mt-2 w-full resize-y rounded-input border border-control bg-surface p-4 text-body text-ink placeholder:text-muted focus-visible:border-ink"
      />
      {!finished && !selfMark && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={ask} disabled={busy || text.trim().length < 10}>{busy ? "Reading your answer…" : tries ? "Check again" : "Get feedback"}</Button>
          {tries > 0 && (
            <Button
              variant="quiet"
              onClick={() => {
                setShowModel(true);
                onDone();
              }}
            >
              Show one good answer
            </Button>
          )}
          {tries === 0 && (
            <button type="button" className="min-h-11 text-small text-muted underline underline-offset-4 hover:text-ink" onClick={() => setSelfMark(true)}>
              Mark it myself
            </button>
          )}
        </div>
      )}

      {grade && (
        <div className="mt-5 rounded-card border border-line bg-surface p-4 sm:p-5" aria-live="polite">
          <State kind={grade.passed ? "ok" : "wrong"} className="font-medium">{grade.passed ? "Every point covered" : `${grade.points.filter((p) => p.met).length} of ${grade.points.length} points covered`}</State>
          <p className="mt-2 text-body text-ink-2">{grade.feedback}</p>
          <ul className="mt-4 grid gap-2">
            {grade.points.map((p, i) => (
              <li key={i} className="text-small">
                {p.met ? (
                  <State kind="ok"><span className="text-ink">{p.point}</span></State>
                ) : (
                  <State kind="wrong"><span className="text-ink">{finished ? p.point : `Point ${i + 1}: ${p.note || "not there yet"}`}</span>{finished && p.note && <span className="block text-ink-2">{p.note}</span>}</State>
                )}
              </li>
            ))}
          </ul>
          {!finished && <p className="mt-4 text-small text-ink-2">Change your answer above and check again. Only your first answer is scored, so there&rsquo;s nothing to lose.</p>}
          {finished && <ModelAnswer text={step.model} />}
          <p className="mt-3 text-small text-muted">Marked by Gemini against the points above. It can be wrong, and it tends to be generous.</p>
        </div>
      )}

      {selfMark && (
        <div className="mt-5 rounded-card border border-line bg-surface p-4 sm:p-5">
          <State kind="note">{aiDown ? "AI feedback isn't available right now, so mark it yourself" : "Mark it yourself"}: tick each point your answer says, in any words. Be strict.</State>
          <fieldset className="mt-4" disabled={selfDone}>
            <legend className="font-mono text-label uppercase text-muted">A good answer says</legend>
            <ul className="mt-2 grid gap-2">
              {step.rubric.map((r, i) => (
                <li key={r}>
                  <label className="flex min-h-11 items-start gap-3 text-body text-ink">
                    <input type="checkbox" checked={ticks[i]} onChange={(e) => setTicks((t) => t.map((x, j) => (j === i ? e.target.checked : x)))} className="mt-1 size-5 shrink-0 accent-ink" />
                    {r}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {!selfDone && <Button className="mt-4" onClick={saveSelf} disabled={text.trim().length < 3}>Save my mark</Button>}
          {selfDone && (
            <>
              <State kind={ticks.every(Boolean) ? "ok" : "note"} className="mt-4">{ticks.every(Boolean) ? "Saved: every point covered." : "Saved. It comes back in review."}</State>
              <ModelAnswer text={step.model} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ModelAnswer({ text }: { text: string }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="font-mono text-label uppercase text-muted">One good answer</p>
      <Prose text={text} className="mt-2" />
    </div>
  );
}

/* ───────────── Dispatcher ───────────── */

export function StepView(props: StepProps<Step>) {
  const { step } = props;
  switch (step.kind) {
    case "learn":
      return <LearnView step={step} />;
    case "predict":
      return <PredictView {...props} step={step} />;
    case "trace":
      return <TraceView {...props} step={step} />;
    case "parsons":
      return <ParsonsView {...props} step={step} />;
    case "bug":
      return <BugView {...props} step={step} />;
    case "compare":
      return <CompareView {...props} step={step} />;
    case "explain":
      return <ExplainView {...props} step={step} />;
    case "run":
      return <RunView {...props} step={step} />;
  }
}
