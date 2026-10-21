"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cx } from "@/components/cx";
import { CAL_LABEL, calStatus, monthCounts, monthGrid, monthJobs, weekBars, type CalStatus } from "@/tools/money/income/calendar";
import type { WorkDay } from "@/tools/money/income/workdays";

/**
 * Five ways to show a month of work days on a phone, for the owner to pick from
 * (/private/money/income/calendar-options). Every status is a shape and a word; colour only
 * repeats it (the owner is red-green colour-blind).
 */

export type PhoneCalProps = { days: readonly WorkDay[]; month: string; today: string };

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const DAY_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDay = (d: string) => DAY_LONG.format(new Date(`${d}T00:00:00Z`));
const shortDay = (d: string) => DAY_SHORT.format(new Date(`${d}T00:00:00Z`));
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
// 1. Marks + day panel: like the phone's own Calendar app. Tap a day to see its jobs below.

export function DotsCalendar({ days, month, today }: PhoneCalProps) {
  const byDay = useByDay(days, month);
  const [sel, setSel] = useState(() => firstDay(byDay, month, today));
  const weeks = monthGrid(month);
  return (
    <div>
      <Counts days={days} month={month} />
      <div className="mt-3"><Weekdays /></div>
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

// ---------------------------------------------------------------------------------------------
// 2. Job bars: like Google Calendar's month view. Each job is a bar across its days.

const BAR: Record<CalStatus, string> = {
  paid: "border-transparent bg-surface-2 text-ink",
  marked: "border-transparent bg-surface-2 text-ink",
  stub: "border-line-2 bg-surface text-ink",
  waiting: "border-dashed border-ember bg-bg text-ink",
  late: "border-2 border-wrong bg-bg text-ink",
  scheduled: "border-dotted border-line-2 bg-bg text-ink-2",
};

export function BarsCalendar({ days, month, today }: PhoneCalProps) {
  const weeks = monthGrid(month);
  const inMonth = useMemo(() => days.filter((d) => d.day.startsWith(month)), [days, month]);
  return (
    <div>
      <Counts days={days} month={month} />
      <div className="mt-3"><Weekdays /></div>
      <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line">
        {weeks.map((w, i) => {
          const bars = weekBars(w, inMonth);
          const lanes = Math.max(1, ...bars.map((b) => b.lane + 1));
          return (
            <div key={i} className="relative bg-surface pb-1.5">
              <div className="grid grid-cols-7">
                {w.map((day, j) => (
                  <span key={j} className={cx("px-1 pt-1 text-[12px] tabular-nums", !day ? "" : day === today ? "text-ink" : "text-muted")}>
                    {day ? (day === today ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-on-primary">{Number(day.slice(8))}</span> : Number(day.slice(8))) : ""}
                  </span>
                ))}
              </div>
              <div className="mt-0.5 grid grid-cols-7 gap-y-0.5 px-0.5" style={{ gridTemplateRows: `repeat(${lanes}, 1.375rem)` }}>
                {bars.map((b) => {
                  const cls = cx("flex min-w-0 items-center gap-1 overflow-hidden rounded-[6px] border px-1 text-[11px] leading-none", BAR[b.status]);
                  const style = { gridColumn: `${b.col + 1} / span ${b.span}`, gridRow: b.lane + 1 };
                  const inner = <><Mark s={b.status} size={10} /><span className="truncate">{b.title}</span><span className="sr-only">, {word(b.status)}</span></>;
                  return b.stubId
                    ? <Link key={b.key} href={`/private/money/income/stubs/${b.stubId}`} className={cls} style={style}>{inner}</Link>
                    : <span key={b.key} className={cls} style={style}>{inner}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 3. Week rows: one row per week, its seven days as marks, and what the week was.

export function WeeksCalendar({ days, month, today }: PhoneCalProps) {
  const byDay = useByDay(days, month);
  const weeks = monthGrid(month);
  return (
    <div>
      <Counts days={days} month={month} />
      <div className="mt-3 px-3"><Weekdays dense /></div>
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {weeks.map((w, i) => {
          const inWeek = w.flatMap((d) => (d ? byDay.get(d) ?? [] : []));
          const titles = [...new Set(inWeek.map((d) => d.title))];
          const real = w.filter(Boolean) as string[];
          const pending = inWeek.filter((d) => ["waiting", "late"].includes(norm(calStatus(d)))).length;
          return (
            <li key={i} className="px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-small text-ink-2">{shortDay(real[0])} – {shortDay(real[real.length - 1])}</span>
                <span className="text-small text-muted">{inWeek.length ? `${inWeek.length} ${inWeek.length === 1 ? "day" : "days"}${pending ? ` · ${pending} not paid` : ""}` : "No work"}</span>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {w.map((day, j) => {
                  const s = day ? worst(byDay.get(day) ?? []) : null;
                  return (
                    <span key={j} className={cx("flex h-12 flex-col items-center justify-center gap-1 rounded-btn text-[12px] tabular-nums", !day ? "invisible" : s ? "bg-surface-2 text-ink" : "text-muted", day === today && "ring-2 ring-ink ring-inset")}>
                      <span aria-hidden="true">{day ? Number(day.slice(8)) : ""}</span>
                      {s ? <Mark s={s} size={13} /> : <span className="h-[13px]" />}
                      <span className="sr-only">{day ? `${WEEKDAY_NAMES[j]} ${Number(day.slice(8))}: ${s ? word(s) : "no work"}` : ""}</span>
                    </span>
                  );
                })}
              </div>
              {titles.length > 0 && <p className="mt-2 truncate text-body text-ink">{titles.join(" · ")}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 4. Job tiles + filter: each worked day is a tile with the job's short name; tap a status to
//    see only those days.

const TILE: Record<CalStatus, string> = {
  paid: "bg-surface-2 border-transparent",
  marked: "bg-surface-2 border-transparent",
  stub: "bg-surface border-line-2",
  waiting: "bg-bg border-dashed border-ember",
  late: "bg-bg border-2 border-wrong",
  scheduled: "bg-bg border-dotted border-line-2",
};
/** A tile's name: hours and times written before it ("12.5hrs Beast Games") left off. */
const short = (t: string) => t.replace(/^[\d.:?]+\s*(hrs?|hr|p|a|pm|am)?\s*/i, "").replace(/\s+/g, " ").trim() || t;

export function TilesCalendar({ days, month, today }: PhoneCalProps) {
  const byDay = useByDay(days, month);
  const [only, setOnly] = useState<CalStatus | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const counts = monthCounts(days, month);
  const weeks = monthGrid(month);
  return (
    <div>
      <div role="group" aria-label="Show only" className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={only === null} onClick={() => setOnly(null)} className={cx("min-h-10 rounded-full border px-3 text-small", only === null ? "border-ink bg-primary text-on-primary" : "border-line text-ink-2")}>All</button>
        {counts.map((c) => (
          <button key={c.status} type="button" aria-pressed={only === c.status} onClick={() => setOnly(only === c.status ? null : c.status)} className={cx("flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-small", only === c.status ? "border-ink bg-surface-2 text-ink" : "border-line text-ink-2")}>
            <Mark s={c.status} size={13} />{c.count} {word(c.status).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="mt-3"><Weekdays /></div>
      <div className="grid gap-1">
        {weeks.map((w, i) => (
          <div key={i} className="grid grid-cols-7 gap-1">
            {w.map((day, j) => {
              if (!day) return <span key={j} />;
              const list = byDay.get(day) ?? [];
              const s = worst(list);
              const dim = only !== null && s !== only;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSel(sel === day ? null : day)}
                  aria-pressed={sel === day}
                  aria-label={`${longDay(day)}${list.length ? `: ${list.map((d) => `${d.title}, ${word(calStatus(d))}`).join("; ")}` : ", no work"}`}
                  className={cx(
                    "flex h-16 min-w-0 flex-col items-start justify-between rounded-btn border p-1 text-left",
                    s ? TILE[s] : "border-transparent",
                    dim && "border-transparent bg-transparent",
                    sel === day && "ring-2 ring-ink",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-0.5">
                    <span className={cx("text-[12px] tabular-nums", day === today ? "rounded-full bg-primary px-1 text-on-primary" : s && !dim ? "text-ink-2" : "text-muted")}>{Number(day.slice(8))}</span>
                    {s && !dim && <Mark s={s} size={11} />}
                  </span>
                  {s && !dim && <span className="w-full truncate text-[11px] leading-tight text-ink">{short(list[0].title)}{list.length > 1 ? ` +${list.length - 1}` : ""}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {sel && <DayDetails day={sel} list={byDay.get(sel) ?? []} today={today} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 5. Mini month + jobs: a small month for the shape of it, then each job as a card.

export function JobsCalendar({ days, month, today }: PhoneCalProps) {
  const byDay = useByDay(days, month);
  const weeks = monthGrid(month);
  const jobs = monthJobs(days, month);
  return (
    <div>
      <div className="rounded-card border border-line bg-surface p-3">
        <Weekdays dense />
        <div className="grid gap-0.5">
          {weeks.map((w, i) => (
            <div key={i} className="grid grid-cols-7">
              {w.map((day, j) => {
                const s = day ? worst(byDay.get(day) ?? []) : null;
                return (
                  <span key={j} className={cx("flex h-9 items-center justify-center text-small tabular-nums", !day && "invisible", day === today && "rounded-full ring-1 ring-ink")}>
                    {s ? <Mark s={s} size={20} /> : <span className="text-muted">{day ? Number(day.slice(8)) : ""}</span>}
                    {day && <span className="sr-only">{longDay(day)}: {s ? word(s) : "no work"}</span>}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 border-t border-line pt-2"><Counts days={days} month={month} /></div>
      </div>
      {jobs.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {jobs.map((j) => {
            const s = worst(j.days)!;
            const first = j.days[0].day;
            const last = j.days[j.days.length - 1].day;
            const stub = j.days.find((d) => d.stubId)?.stubId;
            return (
              <li key={j.eventId} className="rounded-card border border-line bg-surface px-4 py-3">
                <div className="flex items-center gap-3">
                  <Mark s={s} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink">{j.title}</span>
                    <span className="block text-small text-ink-2">{first === last ? shortDay(first) : `${shortDay(first)} – ${shortDay(last)}`} · {j.days.length} {j.days.length === 1 ? "day" : "days"} · {word(s)}</span>
                  </span>
                  {stub && <Link href={`/private/money/income/stubs/${stub}`} className="flex min-h-11 items-center text-small text-ink-2 underline underline-offset-4">Stub</Link>}
                </div>
                {j.days.length > 1 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {j.days.map((d) => (
                      <li key={d.key} className="flex items-center gap-1 rounded-tag border border-line px-1.5 py-0.5 text-[12px] tabular-nums text-ink-2">
                        <Mark s={calStatus(d)} size={11} />{shortDay(d.day)}<span className="sr-only">, {word(calStatus(d))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The shared key under every option. */
export function MarkKey() {
  return (
    <ul aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-1.5 text-small text-ink-2">
      {(["paid", "stub", "waiting", "late", "scheduled"] as const).map((s) => (
        <li key={s} className="flex items-center gap-1.5"><Mark s={s} size={14} />{word(s)}</li>
      ))}
    </ul>
  );
}
