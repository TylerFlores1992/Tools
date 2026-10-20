import Link from "next/link";
import { cx } from "@/components/cx";
import { CAL_LABEL, calStatus, monthCounts, monthGrid, shiftCalMonth, type CalStatus } from "@/tools/money/income/calendar";
import type { WorkDay } from "@/tools/money/income/workdays";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const monthLabel = (m: string) => MONTH.format(new Date(`${m}-01T00:00:00Z`));
const dayLabel = (d: string) => DAY.format(new Date(`${d}T00:00:00Z`));

/**
 * Shape carries the status as well as the word: solid for paid, half for a stub without the money,
 * dashed for waiting, a heavy outline for late, dotted for a day not worked yet. Colour repeats it.
 */
const CHIP: Record<CalStatus, string> = {
  paid: "border-line-2 bg-surface-2 text-ink",
  marked: "border-line-2 bg-surface-2 text-ink",
  stub: "border-line-2 text-ink",
  waiting: "border-dashed border-ember text-ink",
  late: "border-2 border-wrong text-ink",
  scheduled: "border-dotted border-line-2 text-ink-2",
};
const GLYPH: Record<CalStatus, string> = {
  paid: "text-ice", marked: "text-ice", stub: "text-ice", waiting: "text-ember", late: "text-wrong", scheduled: "text-muted",
};

function Chip({ d, compact }: { d: WorkDay; compact?: boolean }) {
  const s = calStatus(d);
  const { word, glyph } = CAL_LABEL[s];
  const body = (
    <>
      <span className="flex items-center gap-1">
        <span aria-hidden="true" className={cx("shrink-0", GLYPH[s])}>{glyph}</span>
        <span className="truncate">{d.title}</span>
      </span>
      <span className={cx("block text-ink-2", compact ? "sr-only" : "")}>{word}</span>
    </>
  );
  const cls = cx("block min-w-0 rounded-tag border px-1.5 py-1 text-label leading-snug", CHIP[s]);
  const title = `${d.title}: ${word}`;
  return d.stubId ? (
    <Link href={`/private/money/income/stubs/${d.stubId}`} className={cx(cls, "hover:bg-surface")} title={title}>{body}</Link>
  ) : (
    <span className={cls} title={title}>{body}</span>
  );
}

/** One month of work days. `month` is YYYY-MM; `href` builds the link for another month. */
export function WorkCalendar({ days, month, today, href, minMonth, maxMonth }: {
  days: readonly WorkDay[]; month: string; today: string; href: (month: string) => string; minMonth: string; maxMonth: string;
}) {
  const byDay = new Map<string, WorkDay[]>();
  for (const d of days) if (d.day.startsWith(month)) (byDay.get(d.day) ?? byDay.set(d.day, []).get(d.day)!).push(d);
  const weeks = monthGrid(month);
  const counts = monthCounts(days, month);
  const prev = shiftCalMonth(month, -1);
  const next = shiftCalMonth(month, 1);
  const inMonth = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const STEP = "flex min-h-11 min-w-11 items-center justify-center rounded-btn border border-line-2 bg-surface text-small text-ink-2 hover:text-ink";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {prev >= minMonth ? <Link href={href(prev)} scroll={false} className={STEP}><span aria-hidden="true">←</span><span className="sr-only">{monthLabel(prev)}</span></Link> : <span className="min-w-11" />}
          <p className="min-w-[10ch] text-center text-h3 tabular-nums" aria-live="polite">{monthLabel(month)}</p>
          {next <= maxMonth ? <Link href={href(next)} scroll={false} className={STEP}><span aria-hidden="true">→</span><span className="sr-only">{monthLabel(next)}</span></Link> : <span className="min-w-11" />}
        </div>
        <p className="text-small text-ink-2">
          {counts.length === 0 ? "No work days on the calendar this month." : counts.map((c) => `${c.count} ${CAL_LABEL[c.status].word.toLowerCase()}`).join(" · ")}
        </p>
      </div>

      {/* Phone: a list of the month's work days. */}
      <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface sm:hidden">
        {inMonth.length === 0 ? <li className="px-4 py-3 text-small text-muted">Nothing booked.</li> : inMonth.map(([day, list]) => (
          <li key={day} className="flex gap-3 px-4 py-3">
            <span className={cx("w-[9ch] shrink-0 text-small tabular-nums", day === today ? "text-ink" : "text-ink-2")}>{dayLabel(day)}{day === today && <span className="block text-label uppercase">Today</span>}</span>
            <span className="grid min-w-0 flex-1 gap-1.5">{list.map((d) => <Chip key={d.key} d={d} />)}</span>
          </li>
        ))}
      </ul>

      {/* Wider: the month grid. */}
      <table className="mt-4 hidden w-full table-fixed border-separate border-spacing-1 sm:table">
        <caption className="sr-only">Work days in {monthLabel(month)}</caption>
        <thead>
          <tr>{WEEKDAYS.map((w) => <th key={w} scope="col" className="pb-1 text-left font-mono text-label font-normal uppercase text-muted">{w}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={i}>
              {w.map((day, j) => day === null ? <td key={j} /> : (
                <td key={day} className={cx("h-24 rounded-btn border p-1.5 align-top", day === today ? "border-ink" : "border-line", day > today ? "bg-bg" : "bg-surface")}>
                  <span className={cx("block text-small tabular-nums", day === today ? "text-ink" : "text-muted")}>
                    {Number(day.slice(8))}{day === today && <span className="ml-1.5 text-label text-ink-2">today</span>}
                  </span>
                  <span className="mt-1 grid gap-1">{(byDay.get(day) ?? []).map((d) => <Chip key={d.key} d={d} />)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul aria-label="Key" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-2">
        {(["paid", "stub", "waiting", "late", "scheduled"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5"><span aria-hidden="true" className={cx("inline-block rounded-tag border px-1 text-label", CHIP[s])}><span className={GLYPH[s]}>{CAL_LABEL[s].glyph}</span></span>{CAL_LABEL[s].word}{s === "stub" ? " (money not in the bank yet)" : s === "late" ? " (no stub after the pay lag)" : s === "scheduled" ? " (not worked yet)" : ""}</li>
        ))}
      </ul>
    </div>
  );
}
