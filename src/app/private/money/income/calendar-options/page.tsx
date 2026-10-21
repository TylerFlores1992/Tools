import type { Metadata } from "next";
import Link from "next/link";
import { Label } from "@/components/Label";
import { requirePrivate } from "@/lib/money/guard";
import { isConfigured } from "@/lib/money/db";
import { getIncomeSettings, listEvents, listStubs } from "@/lib/money/income/store";
import { isCalMonth, shiftCalMonth } from "@/tools/money/income/calendar";
import { BarsCalendar, DotsCalendar, JobsCalendar, MarkKey, TilesCalendar, WeeksCalendar } from "@/tools/money/income/ui/PhoneCalendars";
import { workDays } from "@/tools/money/income/workdays";
import { toLocalDate } from "@/tools/money/simplefin";
import { MoneyShell } from "@/tools/money/ui/MoneyShell";
import { NotConfigured } from "@/tools/money/ui/Setup";

export const metadata: Metadata = { title: "Calendar options · Income", description: "Five phone layouts for the work calendar.", robots: { index: false, follow: false } };

/** Today in Pacific time, read once per request. */
const todayPacific = () => toLocalDate(Date.now() / 1000);
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const OPTIONS = [
  { n: 1, name: "Marks and a day panel", Comp: DotsCalendar,
    about: "Like the phone's own Calendar app. Each day shows one mark for where its pay stands (the most pressing one if there are two jobs). Tap a day to see its jobs underneath.",
    good: "Calmest and easiest to tap; the whole month fits on one screen.", trade: "Job names only show after a tap." },
  { n: 2, name: "Job bars", Comp: BarsCalendar,
    about: "Like Google Calendar's month view. Each job is a bar across the days it ran, with its mark and name; a job splits where its status changes.",
    good: "You see which job ran when, and multi-day jobs read as one thing.", trade: "Names get cut short on single days; busy weeks get taller." },
  { n: 3, name: "Week rows", Comp: WeeksCalendar,
    about: "One row per week: its seven days as marks, how many days and how many aren't paid yet, and the jobs that week.",
    good: "Best for a weekly pay rhythm; nothing is cut off.", trade: "Longer to scroll; less like a calendar." },
  { n: 4, name: "Job tiles and a filter", Comp: TilesCalendar,
    about: "Every worked day is a tile with the job's short name and mark. Tap a status at the top (say, Waiting) to dim everything else; tap a day for its details.",
    good: "Names on every day, and a quick way to find what's still owed.", trade: "Busiest look; short names are only the first few letters." },
  { n: 5, name: "Small month and job cards", Comp: JobsCalendar,
    about: "A small month for the shape of it (marks only), then a card per job with its dates, days and status.",
    good: "Reads like a list of gigs; full names and dates, nothing cramped.", trade: "Two places to look: the month on top, the jobs below." },
] as const;

export default async function CalendarOptions({ searchParams }: { searchParams: Promise<{ cal?: string }> }) {
  await requirePrivate("/private/money/income/calendar-options");
  const sp = await searchParams;
  if (!isConfigured()) return <MoneyShell current="/private/money/income"><NotConfigured /></MoneyShell>;
  const today = todayPacific();
  const month = isCalMonth(sp.cal) ? sp.cal : today.slice(0, 7);
  // One query at a time (src/lib/money/db.ts).
  const events = await listEvents();
  const stubs = await listStubs();
  const { config } = await getIncomeSettings();
  const days = workDays(events, stubs, config, today);
  const nav = (m: string) => `/private/money/income/calendar-options?cal=${m}`;
  const STEP = "flex min-h-11 min-w-11 items-center justify-center rounded-btn border border-line-2 bg-surface text-small text-ink-2 hover:text-ink";

  return (
    <MoneyShell current="/private/money/income">
      <nav aria-label="Breadcrumb" className="text-small text-muted"><Link href="/private/money/income#calendar" className="underline-offset-4 hover:text-ink hover:underline">Income</Link> <span aria-hidden="true">/</span> Calendar options</nav>
      <Label className="mt-4">Work calendar</Label>
      <h1 className="mt-3 text-title font-normal">Five ways on a phone</h1>
      <p className="mt-3 max-w-[60ch] text-body text-ink-2">Each one below is live, with your own work days. Open this page on your phone, try them, and say which number you want. Every status is a shape and a word; color only repeats it.</p>
      <div className="mt-6 flex items-center gap-2">
        <Link href={nav(shiftCalMonth(month, -1))} scroll={false} className={STEP}><span aria-hidden="true">←</span><span className="sr-only">Previous month</span></Link>
        <p className="min-w-[10ch] text-center text-h3 tabular-nums">{MONTH.format(new Date(`${month}-01T00:00:00Z`))}</p>
        <Link href={nav(shiftCalMonth(month, 1))} scroll={false} className={STEP}><span aria-hidden="true">→</span><span className="sr-only">Next month</span></Link>
      </div>
      <div className="mt-4"><MarkKey /></div>

      <div className="mt-8 grid gap-12 lg:grid-cols-2 xl:grid-cols-3">
        {OPTIONS.map(({ n, name, Comp, about, good, trade }) => (
          <section key={n} aria-labelledby={`opt-${n}`} className="min-w-0">
            <h2 id={`opt-${n}`} className="text-h2 font-normal"><span className="tabular-nums text-ink-2">{n}.</span> {name}</h2>
            <p className="mt-2 text-body text-ink-2">{about}</p>
            <ul className="mt-2 grid gap-1 text-small text-ink-2">
              <li><span className="text-ink">Good:</span> {good}</li>
              <li><span className="text-ink">Trade-off:</span> {trade}</li>
            </ul>
            <div className="mt-4 max-w-[390px] rounded-[28px] border border-line-2 bg-bg p-3 shadow-card">
              <Comp key={month} days={days} month={month} today={today} />
            </div>
          </section>
        ))}
      </div>
    </MoneyShell>
  );
}
