"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cx } from "@/components/cx";
import { CAL_LABEL, calStatus, monthCounts, monthGrid, type CalStatus } from "@/tools/money/income/calendar";
import type { WorkDay } from "@/tools/money/income/workdays";

/**
 * The work calendar on a phone: a month of status marks; tap a day to see its jobs underneath.
 * Chosen by the owner on 2026-10-21 from five layouts (marks and a day panel, job bars, week rows,
 * job tiles with a filter, small month with job cards). Every status is a shape and a word;
 * colour only repeats it (the owner is red-green colour-blind).
 */

export type PhoneCalProps = { days: readonly WorkDay[]; month: string; today: string };

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const longDay = (d: string) => DAY_LONG.format(new Date(`${d}T00:00:00Z`));
const ORDER: CalStatus[] = ["late", "waiting", "stub", "scheduled", "paid"];
const norm = (s: CalStatus): CalStatus => (s === "marked" ? "paid" : s);

/** The most pressing status of a day's jobs (late beats waiting beats … beats paid). */
function worst(list: readonly WorkDay[]): CalStatus | null {
  if (!list.length) return null;
  return list.map((d) => norm(calStatus(d))).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
}

function useByDay(days: readonly WorkDay[], month: string) {
  return useMemo(() => {
    const m = new Map<string, WorkDay[]>();
    for (const d of days) if (d.day.startsWith(month)) (m.get(d.day) ?? m.set(d.day, []).get(d.day)!).push(d);
    return m;
  }, [days, month]);
}

const TONE: Record<CalStatus, string> = {
  paid: "text-ice", marked: "text-ice", stub: "text-ice", waiting: "text-ember", late: "text-wrong", scheduled: "text-muted",
};

/** The status shape: filled circle + tick (paid), half circle (stub in), dashed ring (waiting), triangle + ! (late), diamond (booked). */
export function Mark({ s, size = 14, className }: { s: CalStatus; size?: number; className?: string }) {
  const st = norm(s);
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" className={cx("shrink-0", TONE[st], className)}>
      {st === "paid" && <><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="var(--color-bg)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></>}
      {st === "stub" && <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor" /></>}
      {st === "waiting" && <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2.4" />}
      {st === "late" && <><path d="M8 1.6L15 14H1z" fill="currentColor" /><path d="M8 6v3.6" stroke="var(--color-bg)" strokeWidth="1.8" strokeLinecap="round" /><circle cx="8" cy="11.8" r="1" fill="var(--color-bg)" /></>}
      {st === "scheduled" && <path d="M8 1.8L14.2 8 8 14.2 1.8 8z" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    </svg>
  );
}

const word = (s: CalStatus) => CAL_LABEL[norm(s)].word;

/** "7 paid · 5 waiting" with marks. */
function Counts({ days, month }: { days: readonly WorkDay[]; month: string }) {
  const c = monthCounts(days, month);
  if (!c.length) return <p className="text-small text-muted">No work days this month.</p>;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-small text-ink-2">
      {c.map((x) => <li key={x.status} className="flex items-center gap-1.5"><Mark s={x.status} size={13} />{x.count} {word(x.status).toLowerCase()}</li>)}
    </ul>
  );
}

/** One job line for a details list. */
function JobLine({ d }: { d: WorkDay }) {
  const s = calStatus(d);
  const body = (
    <>
      <Mark s={s} size={18} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-ink">{d.title}</span>
        <span className="block text-small text-ink-2">{word(s)}{d.status === "waiting" && d.expected ? ` · about $${Math.round(d.expected).toLocaleString("en-US")} gross` : ""}{d.status === "marked" ? " (marked on the calendar)" : ""}</span>
      </span>
      {d.stubId && <span className="shrink-0 text-small text-ink-2 underline underline-offset-4">Stub</span>}
    </>
  );
  const cls = "flex min-h-12 items-center gap-3 px-4 py-2.5";
  return d.stubId ? <Link href={`/private/money/income/stubs/${d.stubId}`} className={cx(cls, "hover:bg-surface-2")}>{body}</Link> : <div className={cls}>{body}</div>;
}

function DayDetails({ day, list, today }: { day: string; list: readonly WorkDay[]; today: string }) {
  return (
    <div className="mt-3 rounded-card border border-line bg-surface" aria-live="polite">
      <p className="border-b border-line px-4 py-2.5 text-small text-ink-2">{longDay(day)}{day === today ? " · today" : ""}</p>
      {list.length ? <div className="divide-y divide-line">{list.map((d) => <JobLine key={d.key} d={d} />)}</div> : <p className="px-4 py-3 text-small text-muted">No work booked.</p>}
    </div>
  );
}

function firstDay(byDay: Map<string, WorkDay[]>, month: string, today: string) {
  if (today.startsWith(month)) return today;
  return [...byDay.keys()].sort()[0] ?? `${month}-01`;
}

function Weekdays({ dense }: { dense?: boolean }) {
  return (
    <div aria-hidden="true" className={cx("grid grid-cols-7 text-center text-[12px] text-muted", dense ? "pb-1" : "pb-2")}>
      {LETTERS.map((l, i) => <span key={i}>{l}</span>)}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Marks + day panel: like the phone's own Calendar app. Tap a day to see its jobs below.

export function DotsCalendar({ days, month, today, counts = true }: PhoneCalProps & { counts?: boolean }) {
  const byDay = useByDay(days, month);
  const [sel, setSel] = useState(() => firstDay(byDay, month, today));
  const weeks = monthGrid(month);
  return (
    <div>
      {counts && <div className="mb-3"><Counts days={days} month={month} /></div>}
      <Weekdays />
      <div role="grid" aria-label="Work days" className="grid gap-y-1">
        {weeks.map((w, i) => (
          <div role="row" key={i} className="grid grid-cols-7">
            {w.map((day, j) => {
              if (!day) return <span role="gridcell" key={j} />;
              const list = byDay.get(day) ?? [];
              const s = worst(list);
              const on = day === sel;
              return (
                <span role="gridcell" key={day}>
                  <button
                    type="button"
                    onClick={() => setSel(day)}
                    aria-pressed={on}
                    aria-label={`${longDay(day)}${list.length ? `: ${list.map((d) => `${d.title}, ${word(calStatus(d))}`).join("; ")}` : ", no work"}`}
                    className={cx("mx-auto flex h-14 w-full max-w-12 flex-col items-center justify-start gap-1 rounded-btn pt-1.5 text-small tabular-nums", on ? "bg-surface-2 text-ink ring-2 ring-ink ring-inset" : list.length ? "text-ink" : "text-muted")}
                  >
                    <span className={cx(day === today && "rounded-full bg-primary px-1.5 text-on-primary")}>{Number(day.slice(8))}</span>
                    {s ? <Mark s={s} size={14} /> : <span className="h-3.5" />}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <DayDetails day={sel} list={byDay.get(sel) ?? []} today={today} />
    </div>
  );
}

/** The key: each mark and its word. */
export function MarkKey() {
  return (
    <ul aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-1.5 text-small text-ink-2">
      {(["paid", "stub", "waiting", "late", "scheduled"] as const).map((s) => (
        <li key={s} className="flex items-center gap-1.5"><Mark s={s} size={14} />{word(s)}</li>
      ))}
    </ul>
  );
}
