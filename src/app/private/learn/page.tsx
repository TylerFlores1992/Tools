import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, buttonClasses } from "@/components/Button";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { loadProgress } from "@/lib/learn/store";
import { requirePrivate } from "@/lib/money/guard";
import { ALL_LESSONS, findStep, PHASES, quizzesOf } from "@/tools/learn/lessons";
import { dueItems, lessonStatus, nextDue, nextLesson, phaseOpen, solidCount, week } from "@/tools/learn/progress";
import { isGraded } from "@/tools/learn/types";
import { LearnNotConfigured, LearnShell, LearnUnreachable } from "@/tools/learn/ui/LearnShell";

export const metadata: Metadata = {
  title: "Learn to read code",
  description: "Hands-on lessons for reading, tracing and reviewing code.",
  robots: { index: false, follow: false },
};

const dayName = (d: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const longDay = (d: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export default async function LearnHome() {
  await requirePrivate("/private/learn");
  const data = await loadProgress();

  if (data.state !== "ok") {
    return (
      <LearnShell current="/private/learn">
        <h1 className="text-title font-normal">Learn to read code</h1>
        <div className="mt-8">{data.state === "not-configured" ? <LearnNotConfigured /> : <LearnUnreachable />}</div>
      </LearnShell>
    );
  }

  const { lessons: rows, items, today } = data;
  const due = dueItems(items, today, (lessonId, itemId) => Boolean(findStep(lessonId, itemId.slice(lessonId.length + 1))));
  const next = nextLesson(PHASES, rows);
  const nextStatus = next ? lessonStatus(next, rows.get(next.id)) : null;
  const doneCount = ALL_LESSONS.filter((l) => lessonStatus(l, rows.get(l.id)).kind === "done").length;
  const days = week(today, data.studyDays);
  const studied = days.filter((d) => d.studied).length;
  const soon = due.length ? null : nextDue(items, today);

  return (
    <LearnShell current="/private/learn">
      <div className="max-w-[760px]">
        <Label>Learn to read code</Label>
        <h1 className="mt-3 text-title font-normal">
          {due.length ? "Review first, then a lesson." : next ? "Pick up where you left off." : "Every written lesson is done."}
        </h1>
        <p className="mt-3 text-lede text-ink-2">
          Short lessons on reading, tracing and judging code: the skill the AI-training coding gigs test. Phone-friendly, except the &ldquo;Run it&rdquo; steps, which are easier on a computer.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {due.length > 0 && (
            <Link href="/private/learn/review" className={buttonClasses("primary")}>
              Review {due.length} due <Arrow />
            </Link>
          )}
          {next && (
            <Link href={`/private/learn/${next.id}`} className={buttonClasses(due.length ? "quiet" : "primary")}>
              {nextStatus?.kind === "started" ? "Continue" : "Start"} {next.number} {next.title} {!due.length && <Arrow />}
            </Link>
          )}
        </div>
        {!due.length && soon && <p className="mt-3 text-small text-muted">Nothing to review today. The next review is {longDay(soon)}.</p>}
      </div>

      <section aria-label="Your progress" className="mt-12 grid max-w-[960px] gap-4 sm:grid-cols-3">
        <Stat label="Lessons done" value={`${doneCount}`} of={`of ${ALL_LESSONS.length} written`} />
        <Stat label="Solid" value={`${solidCount(items)}`} of={`of ${items.length} items you've seen`} hint="Right several times in a row, spaced out." />
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <p className="font-mono text-label uppercase text-muted">This week</p>
          <p className="mt-2 text-h2 font-normal tabular-nums">
            {studied} <span className="text-body text-ink-2">of 7 days</span>
          </p>
          <ol className="mt-3 flex gap-1.5" aria-label="Days studied this week">
            {days.map((d) => (
              <li key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span aria-hidden="true" className={d.studied ? "flex size-7 items-center justify-center rounded-full border border-ink bg-ink text-small text-bg" : "flex size-7 items-center justify-center rounded-full border border-line-2 text-small text-muted"}>
                  {d.studied ? "✓" : ""}
                </span>
                <span className="text-[0.7rem] text-muted">{dayName(d.date).slice(0, 2)}</span>
                <span className="sr-only">{`${dayName(d.date)}: ${d.studied ? "studied" : "no study"}`}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mt-16 grid max-w-[960px] gap-10">
        {PHASES.map((phase, pi) => {
          const open = phaseOpen(PHASES, pi, rows);
          return (
            <section key={phase.id} aria-labelledby={`phase-${phase.id}`}>
              <p className="font-mono text-label uppercase text-muted">
                Phase {phase.number} · {phase.weeks}
              </p>
              <h2 id={`phase-${phase.id}`} className="mt-2 text-h2 font-normal">{phase.title}</h2>
              <p className="mt-2 max-w-[68ch] text-body text-ink-2">{phase.summary}</p>
              {!phase.lessons.length ? (
                <p className="mt-4 text-small"><State kind="note">Lessons for this phase come next. {pi > 0 && "It opens when the phase before it is passed."}</State></p>
              ) : (
                <ol className="mt-5 grid gap-2">
                  {phase.lessons.map((l) => {
                    const s = lessonStatus(l, rows.get(l.id));
                    const graded = l.steps.filter(isGraded).length;
                    return (
                      <li key={l.id}>
                        {open ? (
                          <Link href={`/private/learn/${l.id}`} className="grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-3 rounded-input border border-line bg-surface px-4 py-3 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] transition-colors duration-150 hover:border-control hover:bg-surface-2">
                          <span className="font-mono text-label tabular-nums text-muted">{l.number}</span>
                          <span className="min-w-0">
                            <span className="block text-body text-ink">
                              {l.title}
                              {l.checkpoint && <span className="ml-2 rounded-tag border border-line-2 px-1.5 py-0.5 font-mono text-label uppercase text-ink-2">Checkpoint</span>}
                            </span>
                            <span className="block text-small text-muted">{l.goal} · about {l.minutes} min · {graded} to answer</span>
                          </span>
                          <span className="col-start-2 mt-1 text-small sm:col-start-3 sm:mt-0">
                            {s.kind === "done" && (s.passed ? <State kind="ok">Done{s.score != null && s.outOf ? ` · ${s.score}/${s.outOf}` : ""}</State> : <State kind="wrong">Not passed · {s.score}/{s.outOf}</State>)}
                            {s.kind === "started" && <span className="text-ink-2">Step {s.step + 1} of {l.steps.length}</span>}
                            {s.kind === "new" && <span className="text-muted">{open ? "Not started" : "Locked"}</span>}
                          </span>
                          </Link>
                        ) : (
                          <div className="grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-3 rounded-input border border-line bg-surface px-4 py-3 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] border-dashed">
                          <span className="font-mono text-label tabular-nums text-muted">{l.number}</span>
                          <span className="min-w-0">
                            <span className="block text-body text-ink">
                              {l.title}
                              {l.checkpoint && <span className="ml-2 rounded-tag border border-line-2 px-1.5 py-0.5 font-mono text-label uppercase text-ink-2">Checkpoint</span>}
                            </span>
                            <span className="block text-small text-muted">{l.goal} · about {l.minutes} min · {graded} to answer</span>
                          </span>
                          <span className="col-start-2 mt-1 text-small sm:col-start-3 sm:mt-0">
                            {s.kind === "done" && (s.passed ? <State kind="ok">Done{s.score != null && s.outOf ? ` · ${s.score}/${s.outOf}` : ""}</State> : <State kind="wrong">Not passed · {s.score}/{s.outOf}</State>)}
                            {s.kind === "started" && <span className="text-ink-2">Step {s.step + 1} of {l.steps.length}</span>}
                            {s.kind === "new" && <span className="text-muted">{open ? "Not started" : "Locked"}</span>}
                          </span>
                          </div>
                        )}
                        {open && quizzesOf(l.id).length > 0 && (
                          <ul aria-label={`Practice quizzes for ${l.number}`} className="mt-1.5 flex flex-wrap gap-1.5 pl-[3.5rem]">
                            {quizzesOf(l.id).map((q, qi) => {
                              const qs = lessonStatus(q, rows.get(q.id));
                              return (
                                <li key={q.id}>
                                  <Link
                                    href={`/private/learn/${q.id}`}
                                    aria-label={`Quiz ${qi + 1}, ${q.title}: ${qs.kind === "done" ? "done" : qs.kind === "started" ? "in progress" : "not taken"}`}
                                    className="flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-small text-ink-2 transition-colors duration-150 hover:border-control hover:text-ink"
                                  >
                                    Quiz {qi + 1}
                                    {qs.kind === "done" && <State kind="ok">{qs.score != null && qs.outOf ? `${qs.score}/${qs.outOf}` : "Done"}</State>}
                                    {qs.kind === "started" && <span className="text-muted">· started</span>}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </LearnShell>
  );
}

function Stat({ label, value, of, hint }: { label: string; value: string; of: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <p className="font-mono text-label uppercase text-muted">{label}</p>
      <p className="mt-2 text-h2 font-normal tabular-nums">
        {value} <span className="text-body text-ink-2">{of}</span>
      </p>
      {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
    </div>
  );
}
