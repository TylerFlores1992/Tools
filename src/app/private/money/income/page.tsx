import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { fileEdd, markNotPay, unfileEdd } from "./actions";
import { requirePrivate } from "@/lib/money/guard";
import { isConfigured } from "@/lib/money/db";
import { getIncomeSettings, listEvents, listStubs } from "@/lib/money/income/store";
import { getTransactions } from "@/lib/money/store";
import { employerKey, sameEmployer, taxTotal, workedHours } from "@/tools/money/income/checks";
import { healthPeriods } from "@/tools/money/income/health";
import { missingStubs } from "@/tools/money/income/missing";
import { replacedBy } from "@/tools/money/income/reissue";
import { benefitsByProgram, isBenefit, PFL, PROGRAMS, unfiledEdd, yearOfBenefit } from "@/tools/money/income/benefits";
import { TAX_KEYS, TAX_LABEL, type Stub } from "@/tools/money/income/types";
import { TAX_YEAR, w2Check, withholdingEstimate } from "@/tools/money/income/withholding";
import { workDays, type WorkDay } from "@/tools/money/income/workdays";
import { toLocalDate } from "@/tools/money/simplefin";
import { money, monthName, shortDate } from "@/tools/money/summary";
import { InOutChart } from "@/tools/money/ui/Charts";
import { isCalMonth } from "@/tools/money/income/calendar";
import { WorkCalendar } from "@/tools/money/income/ui/WorkCalendar";
import { CalendarRefresh } from "@/tools/money/income/ui/CalendarRefresh";
import { refreshPending } from "@/tools/money/income/refresh";
import { StatTile } from "@/tools/money/ui/StatTile";
import { ChoiceLink, MoneyShell, Tag } from "@/tools/money/ui/MoneyShell";
import { NotConfigured } from "@/tools/money/ui/Setup";

export const metadata: Metadata = {
  title: "Income · Money",
  description: "Pay stubs, what you've been paid and taxed, and pay still owed.",
  robots: { index: false, follow: false },
};

/** Today in Pacific time, read once per request. */
const todayPacific = () => toLocalDate(Date.now() / 1000);

const yearOf = (s: Stub) => s.taxYear ?? (s.payDate ? Number(s.payDate.slice(0, 4)) : null);

export default async function IncomePage({ searchParams }: { searchParams: Promise<{ year?: string; saved?: string; cal?: string }> }) {
  await requirePrivate("/private/money/income");
  const sp = await searchParams;
  if (!isConfigured()) return <MoneyShell current="/private/money/income"><h1 className="text-title font-normal">Income</h1><div className="mt-8"><NotConfigured /></div></MoneyShell>;

  // One query at a time (src/lib/money/db.ts).
  const stubs = await listStubs();
  const settings = await getIncomeSettings();
  const events = await listEvents();
  const { config } = settings;
  const today = todayPacific();
  const thisYear = Number(today.slice(0, 4));
  const years = [...new Set([thisYear, ...stubs.map(yearOf).filter((y): y is number => !!y)])].sort((a, b) => b - a);
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : thisYear;

  const txns = await getTransactions(`${year}-01-01`);
  const missing = missingStubs(txns.filter((t) => t.posted <= `${year}-12-31`), stubs, year);
  const missingCount = missing.reduce((n, g) => n + g.deposits.length, 0);
  const eddUnfiled = unfiledEdd(txns.filter((t) => t.posted <= `${year}-12-31`), stubs);
  const eddFiled = stubs.filter((s) => isBenefit(s) && yearOfBenefit(s) === year).sort((a, b) => (a.payDate ?? "").localeCompare(b.payDate ?? ""));
  const eddTotals = benefitsByProgram(stubs, year);

  // A reissued week's first stub still counts as money received, not toward gross/taxes/hours (reissue.ts).
  const replaced = replacedBy(stubs);
  const paid = stubs.filter((s) => s.status === "saved" && s.kind === "stub" && yearOf(s) === year);
  const saved = paid.filter((s) => !replaced.has(s.id));
  const w2s = stubs.filter((s) => s.status === "saved" && s.kind === "w2" && (s.w2?.taxYear ?? yearOf(s)) === year);
  const toReview = stubs.filter((s) => s.status !== "saved");
  const gross = saved.reduce((n, s) => n + (s.gross ?? 0), 0);
  const net = paid.reduce((n, s) => n + (s.net ?? 0), 0);
  const taxes = saved.reduce((n, s) => n + taxTotal(s), 0);
  const hours = saved.reduce((n, s) => n + workedHours(s), 0);
  const estimatedGross = saved.filter((s) => s.estimated).reduce((n, s) => n + (s.gross ?? 0), 0);
  const stubMonths = [...paid.reduce((map, x) => { const k = (x.payDate ?? "0000-00").slice(0, 7); (map.get(k) ?? map.set(k, []).get(k)!).push(x); return map; }, new Map<string, Stub[]>())].sort(([a], [b]) => b.localeCompare(a));
  const notInBank = paid.filter((s) => !s.depositTxnId && s.depositMatch !== "none");

  const days = workDays(events, stubs, config, today);
  const waiting = days.filter((d) => d.status === "waiting");
  const owedGroups = groupByEvent(waiting);
  const expectedTotal = waiting.reduce((n, d) => n + (d.expected ?? 0), 0);
  const unknownExpected = waiting.some((d) => d.expected === null);
  // The work calendar's month: ?cal=YYYY-MM, else this month (or December of a past year).
  const eventMonths = days.map((d) => d.day.slice(0, 7));
  const calMin = eventMonths.length ? eventMonths.reduce((a, b) => (a < b ? a : b)) : today.slice(0, 7);
  const calMax = [today.slice(0, 7), ...eventMonths].reduce((a, b) => (a > b ? a : b));
  const calMonth = isCalMonth(sp.cal) && sp.cal >= calMin && sp.cal <= calMax ? sp.cal : year === thisYear ? today.slice(0, 7) : `${year}-12`;
  const calHref = (m: string) => `/private/money/income?${new URLSearchParams({ ...(year !== thisYear ? { year: String(year) } : {}), cal: m })}#calendar`;

  // Chart: gross vs taxes by month of pay date.
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).filter((m) => m <= today.slice(0, 7));
  const chart = months.map((m) => {
    const inMonth = saved.filter((s) => (s.payDate ?? "").startsWith(m));
    return { month: m, label: monthName(m).slice(0, 3), moneyIn: round(inMonth.reduce((n, s) => n + (s.gross ?? 0), 0)), moneyOut: round(inMonth.reduce((n, s) => n + taxTotal(s), 0)), empty: inMonth.length === 0 };
  });

  // By employer.
  const byEmployer = new Map<string, { name: string; stubs: Stub[] }>();
  for (const s of saved) {
    const k = employerKey(s);
    const row = byEmployer.get(k) ?? { name: s.employer || s.payrollCompany || "Unknown employer", stubs: [] };
    row.stubs.push(s);
    byEmployer.set(k, row);
  }
  const employers = [...byEmployer.entries()].map(([key, r]) => ({ key, ...r, gross: r.stubs.reduce((n, s) => n + (s.gross ?? 0), 0) })).sort((a, b) => b.gross - a.gross);

  const health = healthPeriods(stubs, config, today);
  const currentHealth = health.find((p) => p.current);
  const estimate = year === thisYear ? withholdingEstimate(stubs, config, today) : null;
  const calendarConnected = !!settings.keyHash;

  return (
    <MoneyShell current="/private/money/income">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-2 pb-6">
        <div>
          <Label>Money</Label>
          <h1 className="mt-3 text-title font-normal">Income {year}</h1>
          <div className="mt-3 max-w-[60ch] text-small text-muted">
            {calendarConnected ? (
              <CalendarRefresh lastRunAt={settings.lastRunAt} pending={refreshPending(settings.lastRunAt, settings.refreshAt)} scriptVersion={scriptVersionOf(settings.lastSummary)}>
                <Link href="/private/money/settings#income" className="underline underline-offset-4 hover:text-ink">Calendar settings</Link>
              </CalendarRefresh>
            ) : <>Calendar not connected · <Link href="/private/money/settings#income" className="underline underline-offset-4 hover:text-ink">Calendar settings</Link></>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/private/money/income/add">Add stubs</LinkButton>
          <LinkButton href="/private/money/income/add?kind=w2" variant="quiet">Add a W-2</LinkButton>
        </div>
      </div>

      {years.length > 1 && (
        <div role="group" aria-label="Year" className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
          {years.map((y) => <ChoiceLink key={y} href={y === thisYear ? "/private/money/income" : `/private/money/income?year=${y}`} on={y === year}>{y}</ChoiceLink>)}
        </div>
      )}
      {sp.saved && <p className="mt-6"><State kind="ok">Saved.{stubs.find((s) => s.id === sp.saved)?.depositTxnId ? " Its deposit was found in the bank." : ""}</State></p>}

      <section aria-label="Totals" className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Gross pay" value={money(gross)} note={`${saved.length} ${saved.length === 1 ? "stub" : "stubs"}${estimatedGross ? `, ${money(estimatedGross)} estimated` : ""}`} />
        <StatTile label="Taxes withheld" value={money(taxes)} note={gross ? `${Math.round((taxes / gross) * 100)}% of gross` : "–"} />
        <StatTile label="Take-home" value={money(net)} note={notInBank.length ? `${notInBank.length} not in the bank yet` : saved.length ? "All found in the bank" : "–"} />
        <StatTile label="Hours worked" value={`${round1(hours)} h`} note={hours && gross ? `About ${money(gross / hours)} an hour, gross` : "From the stubs’ pay lines"} />
      </section>

      <nav aria-label="On this page" className="mt-6 overflow-x-auto">
        <ul className="flex w-max gap-1 text-small sm:w-auto sm:flex-wrap">
          {[
            ...(toReview.length ? [["review", `To check (${toReview.length})`]] : []),
            ...(missingCount ? [["missing", "Missing stubs"]] : []),
            ["owed", "Pay still owed"],
            ...(calendarConnected ? [["calendar", "Work calendar"]] : []),
            ...(saved.length ? [["by-month", "By month"]] : []),
            ["emp", "Employers"],
            ...(config.health.show ? [["health", "Health hours"]] : []),
            ...(eddFiled.length || eddUnfiled.length ? [["edd", "EDD"]] : []),
            ...(estimate ? [["fed", "Withholding"]] : []),
            ...(w2s.length ? [["w2", "W-2"]] : []),
            ["stubs", "Stubs"],
          ].map(([id, label]) => <li key={id}><a href={`#${id}`} className="flex min-h-10 items-center rounded-full border border-line px-3 text-ink-2 hover:text-ink">{label}</a></li>)}
        </ul>
      </nav>

      {toReview.length > 0 && (
        <section aria-labelledby="review" className="mt-8 scroll-mt-6">
          <h2 id="review" className="text-h2 font-normal">Waiting for you to check</h2>
          <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
            {toReview.map((s) => (
              <li key={s.id}>
                <Link href={`/private/money/income/stubs/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0 truncate text-body">{s.kind === "w2" ? "W-2" : "Pay stub"} · {s.employer || s.payrollCompany || "not read yet"}{s.payDate ? ` · ${shortDate(s.payDate)}` : ""}</span>
                  <Tag>{s.status === "failed" ? "Couldn’t read" : s.status === "reading" ? "Reading" : "Check it"}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {missingCount > 0 && (
        <section aria-labelledby="missing" className="mt-8 scroll-mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="missing" className="text-h2 font-normal">Stubs still missing</h2>
            <p className="text-body text-ink-2">{missingCount} {missingCount === 1 ? "payment" : "payments"} in the bank with no stub, from {missing.length} {missing.length === 1 ? "payer" : "payers"}</p>
          </div>
          <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
            {missing.map((g) => (
              <li key={g.key}>
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block text-body text-ink">{g.name}</span>
                      <span className="mt-1 block text-small text-muted">{g.deposits.length} {g.deposits.length === 1 ? "payment" : "payments"} · {shortDate(g.deposits[0].posted)}{g.deposits.length > 1 ? ` – ${shortDate(g.deposits[g.deposits.length - 1].posted)}` : ""}</span>
                    </span>
                    <span className="text-body tabular-nums">{money(g.total)}</span>
                  </summary>
                  <ul className="border-t border-line px-4 py-2 text-small">
                    {g.deposits.map((d, i) => (
                      <li key={`${d.id}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1">
                        <span className="text-ink-2">Arrived {shortDate(d.posted)}</span>
                        <span className="flex items-center gap-3">
                          <span className="tabular-nums">{money(d.amount)}</span>
                          <form action={markNotPay}><input type="hidden" name="txn" value={d.id} /><button type="submit" className="min-h-11 rounded-btn px-2 text-small text-ink-2 underline underline-offset-4 hover:text-ink">Not pay</button></form>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-small text-muted">From your bank deposits: each one drops off when a saved stub&rsquo;s take-home matches it, or when you mark it &ldquo;Not pay&rdquo; (a settlement, a refund check: it&rsquo;s filed as Other income). Dates are when the money arrived, not the pay date. <Link href="/private/money/income/add" className="underline underline-offset-4 hover:text-ink">Add them all at once</Link>.</p>
        </section>
      )}

      <section aria-labelledby="owed" className="mt-12 scroll-mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="owed" className="text-h2 font-normal">Pay still owed</h2>
          {waiting.length > 0 && <p className="text-body text-ink-2">{waiting.length} {waiting.length === 1 ? "day" : "days"} worked{expectedTotal ? <>, about <span className="tabular-nums text-ink">{money(expectedTotal)}</span> gross{unknownExpected ? " (some without a rate)" : ""}</> : ""}</p>}
        </div>
        {!calendarConnected ? (
          <p className="mt-4 max-w-[64ch] text-body text-ink-2">Connect your Google Calendar in <Link href="/private/money/settings#income" className="text-ink underline underline-offset-4">Settings</Link> and every work day will show here until its stub and pay arrive.</p>
        ) : owedGroups.length === 0 && notInBank.length === 0 ? (
          <p className="mt-4"><State kind="ok">Nothing owed: every work day so far has a stub.</State></p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
            {owedGroups.map((g) => (
              <li key={g.eventId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-body text-ink">{g.title}</span>
                  <span className="mt-1 block text-small text-muted">{g.days.length === 1 ? shortDate(g.days[0].day) : `${shortDate(g.days[0].day)} – ${shortDate(g.days[g.days.length - 1].day)}`} · {g.days.length} {g.days.length === 1 ? "day" : "days"} · {ago(g.days[g.days.length - 1].ageDays)}</span>
                </span>
                <span className="flex items-center gap-3">
                  {g.late && <Tag>Late</Tag>}
                  <span className="text-body tabular-nums text-ink-2">{g.expected ? `≈ ${money(g.expected)}` : "No stub yet"}</span>
                </span>
              </li>
            ))}
            {notInBank.map((s) => (
              <li key={s.id}>
                <Link href={`/private/money/income/stubs/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block text-body text-ink">{s.showName || s.employer || "Stub"}</span>
                    <span className="mt-1 block text-small text-muted">Stub in, money not in the bank yet · paid {s.payDate ? shortDate(s.payDate) : "?"}</span>
                  </span>
                  <span className="text-body tabular-nums">{s.net !== null ? money(s.net) : "–"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {calendarConnected && <p className="mt-2 text-small text-muted">“Late” means no stub {config.payLagDays} days after the day. Amounts are estimates from your rate at {config.defaultHoursPerDay} hours a day, California overtime.</p>}
      </section>

      {calendarConnected && (
        <section aria-labelledby="calendar" className="mt-12 min-w-0 scroll-mt-6">
          <h2 id="calendar" className="text-h2 font-normal">Work calendar</h2>
          <p className="mt-2 max-w-[68ch] text-body text-ink-2">Your work days from your calendar (and any you imported), and where each day&rsquo;s pay stands. Tap a paid day to open its stub.</p>
          <div className="mt-4">
            <WorkCalendar days={days} month={calMonth} today={today} href={calHref} minMonth={calMin} maxMonth={calMax} />
          </div>
        </section>
      )}

      {saved.length > 0 && (
        <section aria-labelledby="by-month" className="mt-12 min-w-0 scroll-mt-6">
          <h2 id="by-month" className="sr-only">Gross and taxes by month</h2>
          <InOutChart points={chart} title={`${year} by month`} labels={{ in: "Gross pay", out: "Taxes withheld" }} />
          <details className="mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-small text-ink-2 hover:text-ink">Show as a table</summary>
            <table className="mt-2 w-full text-small">
              <thead><tr className="border-b border-line text-left text-ink-2"><th scope="col" className="py-1.5 font-normal">Month</th><th scope="col" className="py-1.5 text-right font-normal">Gross</th><th scope="col" className="py-1.5 text-right font-normal">Taxes</th></tr></thead>
              <tbody className="divide-y divide-line">{chart.map((c) => <tr key={c.month}><th scope="row" className="py-1.5 text-left font-normal">{monthName(c.month)}</th><td className="py-1.5 text-right tabular-nums">{money(c.moneyIn)}</td><td className="py-1.5 text-right tabular-nums">{money(c.moneyOut)}</td></tr>)}</tbody>
            </table>
          </details>
        </section>
      )}

      <div className={`mt-12 grid gap-10 ${config.health.show ? "lg:grid-cols-2" : "max-w-[860px]"}`}>
        <section aria-labelledby="emp" className="min-w-0 scroll-mt-6">
          <h2 id="emp" className="text-h2 font-normal">By employer</h2>
          {employers.length === 0 ? <p className="mt-4 text-body text-ink-2">No saved stubs for {year} yet.</p> : (
            <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
              {employers.slice(0, TOP_EMPLOYERS).map((e) => {
                const t = e.stubs.reduce((n, s) => n + taxTotal(s), 0);
                const h = e.stubs.reduce((n, s) => n + workedHours(s), 0);
                return (
                  <li key={e.key} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-body text-ink">{e.name}</span>
                      <span className="mt-1 block text-small text-muted">{e.stubs.length} {e.stubs.length === 1 ? "stub" : "stubs"} · {round1(h)} h · {money(t)} taxes</span>
                    </span>
                    <span className="shrink-0 text-body tabular-nums">{money(e.gross)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {employers.length > TOP_EMPLOYERS && (
            <details className="mt-2">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-small text-ink-2 hover:text-ink">Show {employers.length - TOP_EMPLOYERS} more</summary>
              <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
                {employers.slice(TOP_EMPLOYERS).map((e) => (
                  <li key={e.key} className="flex items-center justify-between gap-4 px-4 py-2.5 text-small">
                    <span className="min-w-0 truncate text-ink">{e.name} <span className="text-muted">· {e.stubs.length} {e.stubs.length === 1 ? "stub" : "stubs"}</span></span>
                    <span className="shrink-0 tabular-nums">{money(e.gross)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {config.health.show && (
        <section aria-labelledby="health" className="min-w-0 scroll-mt-6">
          <h2 id="health" className="text-h2 font-normal">{config.health.name} hours</h2>
          {currentHealth ? (
            <Card className="mt-4">
              <p className="text-small text-ink-2">{currentHealth.label}</p>
              <p className="mt-1 text-title font-normal tabular-nums">{round1(currentHealth.hours)}<span className="sr-only"> hours</span></p>
              <p className="text-body text-ink-2">of {currentHealth.needed} hours needed</p>
              <span aria-hidden="true" className="mt-3 block h-2 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-ice" style={{ width: `${Math.min(100, (currentHealth.hours / Math.max(1, currentHealth.needed)) * 100)}%` }} />
              </span>
              <p className="mt-2 text-small text-ink-2">{currentHealth.hours >= currentHealth.needed ? <State kind="ok">Enough hours this period.</State> : `${round1(currentHealth.needed - currentHealth.hours)} hours to go by ${shortDate(currentHealth.to)}.`}</p>
              <ul className="mt-4 grid gap-1 text-small text-muted">
                {health.filter((p) => !p.current).reverse().map((p) => <li key={p.from}>{p.label}: {round1(p.hours)} h{p.hours >= p.needed ? " · met" : ""}</li>)}
              </ul>
            </Card>
          ) : null}
          <p className="mt-2 text-small text-muted">Counted from your saved stubs (straight, 1.5× and 2× hours). The plan&rsquo;s own count is what decides coverage; set the rules in <Link href="/private/money/settings#pay" className="underline underline-offset-4 hover:text-ink">Settings</Link>.</p>
        </section>
        )}
      </div>

      {(eddFiled.length > 0 || eddUnfiled.length > 0) && (
        <section aria-labelledby="edd" className="mt-12 max-w-[860px] scroll-mt-6">
          <h2 id="edd" className="text-h2 font-normal">EDD benefits</h2>
          <p className="mt-2 max-w-[68ch] text-body text-ink-2">Paid Family Leave is taxed on your federal return only, with nothing withheld. Disability Insurance usually isn&rsquo;t taxed at all. Neither is taxed by California, and neither is wages. EDD sends a 1099-G for Paid Family Leave.</p>
          {eddTotals.length > 0 && (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {eddTotals.map((b) => (
                <li key={b.program}><Card>
                  <p className="text-small text-ink-2">{b.program} {year}</p>
                  <p className="mt-2 text-h2 font-normal tabular-nums">{money(b.total)}</p>
                  <p className="mt-1 text-small text-muted">{b.count} {b.count === 1 ? "payment" : "payments"} · {b.federallyTaxable ? "federal taxable, not California" : "not taxable"}</p>
                </Card></li>
              ))}
            </ul>
          )}
          {eddUnfiled.length > 0 && (
            <>
              <p className="mt-6 text-body text-ink">EDD deposits to file</p>
              <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
                {eddUnfiled.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                    <span className="text-body">{shortDate(t.posted)} · <span className="tabular-nums">{money(t.amount)}</span></span>
                    <span className="flex flex-wrap gap-2">
                      {PROGRAMS.map((p) => (
                        <form key={p} action={fileEdd}><input type="hidden" name="txn" value={t.id} /><input type="hidden" name="program" value={p} />
                          <button type="submit" className="min-h-11 rounded-btn border border-line-2 bg-surface px-3 text-small text-ink hover:bg-surface-2">{p === PFL ? "Family leave" : "Disability"}</button>
                        </form>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {eddFiled.length > 0 && (
            <details className="mt-4">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-small text-ink-2 hover:text-ink">Show the {eddFiled.length} filed {eddFiled.length === 1 ? "payment" : "payments"}</summary>
              <ul className="mt-2 divide-y divide-line text-small">
                {eddFiled.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-1">
                    <span className="text-ink-2">{s.payDate ? shortDate(s.payDate) : "?"} · {s.showName}</span>
                    <span className="flex items-center gap-3"><span className="tabular-nums">{money(s.gross ?? 0)}</span>
                      <form action={unfileEdd}><input type="hidden" name="id" value={s.id} /><button type="submit" className="min-h-11 px-2 text-small text-ink-2 underline underline-offset-4 hover:text-ink">Unfile</button></form>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {estimate && (
        <section aria-labelledby="fed" className="mt-12 max-w-[860px] scroll-mt-6">
          <h2 id="fed" className="text-h2 font-normal">Is enough federal tax being withheld?</h2>
          <p className="mt-2 max-w-[68ch] text-body text-ink-2">Each employer withholds as if it were your only job. This adds them up against a rough {TAX_YEAR} federal tax ({config.tax.filing === "joint" ? "married filing jointly" : "single"}, standard deduction{config.tax.otherWages ? `, plus ${money(config.tax.otherWages)} other household wages` : ""}).</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {estimate.scenarios.map((s) => (
              <li key={s.label}>
                <Card>
                  <p className="text-small text-ink-2">{s.label}</p>
                  <p className="mt-2 text-h2 font-normal tabular-nums">{s.gap > 0 ? `You'd owe ≈ ${money(s.gap)}` : `Refund ≈ ${money(-s.gap)}`}</p>
                  <p className="mt-1 text-small text-muted">{estimate.benefits ? "Wages and family leave" : "Wages"} {money(s.wages)} · tax ≈ {money(s.tax)} · withheld {money(s.withheld)}</p>
                </Card>
              </li>
            ))}
          </ul>
          <ul className="mt-3 grid gap-1 text-small text-muted">
            <li>Overtime premium on your stubs this year: {money(estimate.overtimePremium)}. The new “no tax on overtime” deduction covers only overtime federal law requires, not California daily or union overtime, so it isn&rsquo;t counted unless you turn it on in settings.</li>
            {estimate.ssOverWithheld > 0 && <li>Social Security withheld across employers is {money(estimate.ssOverWithheld)} over the {TAX_YEAR} wage-base maximum; that comes back when you file.</li>}
            {estimate.benefits > 0 && <li>Includes {money(estimate.benefits)} of Paid Family Leave: federal taxable, with nothing withheld on it.</li>}
            <li>California tax isn&rsquo;t estimated: its {TAX_YEAR} schedule wasn&rsquo;t published yet. A guide only, not tax advice.</li>
          </ul>
        </section>
      )}

      {w2s.length > 0 && (
        <section aria-labelledby="w2" className="mt-12 max-w-[860px] scroll-mt-6">
          <h2 id="w2" className="text-h2 font-normal">W-2 check</h2>
          {w2s.map((w) => {
            const mine = saved.filter((s) => sameEmployer(w, s));
            const r = w2Check(w.w2!, mine);
            return (
              <Card key={w.id} className="mt-4">
                <p className="text-body text-ink"><Link href={`/private/money/income/stubs/${w.id}`} className="underline-offset-4 hover:underline">{w.employer || w.payrollCompany || "W-2"}</Link> <span className="text-small text-muted">· against {r.stubCount} saved {r.stubCount === 1 ? "stub" : "stubs"}</span></p>
                <table className="mt-3 w-full text-small">
                  <thead><tr className="border-b border-line text-left text-ink-2"><th scope="col" className="py-1.5 font-normal">Item</th><th scope="col" className="py-1.5 text-right font-normal">W-2</th><th scope="col" className="py-1.5 text-right font-normal">Stubs</th><th scope="col" className="py-1.5 pl-3 font-normal">Result</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {r.lines.map((l) => (
                      <tr key={l.label}>
                        <th scope="row" className="py-1.5 pr-2 text-left font-normal">{l.label}</th>
                        <td className="py-1.5 text-right tabular-nums">{l.w2 === null ? "–" : money(l.w2)}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.stubs === null ? "–" : money(l.stubs)}</td>
                        <td className="py-1.5 pl-3">{l.w2 === null || l.stubs === null ? <span className="text-muted">–</span> : l.differs ? <State kind="wrong">Differs</State> : <State kind="ok">Matches</State>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {r.lines.some((l) => l.differs) && <p className="mt-2 text-small text-muted">A difference usually means a stub is missing here, or one was misread. Add or fix it, or ask the payroll company for a corrected W-2 (W-2c).</p>}
              </Card>
            );
          })}
        </section>
      )}

      <section aria-labelledby="stubs" className="mt-12 scroll-mt-6">
        <h2 id="stubs" className="text-h2 font-normal">Stubs</h2>
        {saved.length === 0 ? <p className="mt-4 text-body text-ink-2">None saved for {year}. <Link href="/private/money/income/add" className="text-ink underline underline-offset-4">Add your first one.</Link></p> : (
          <div className="mt-4 grid gap-3">
            {stubMonths.map(([m, list], i) => (
              <details key={m} open={i === 0} className="group rounded-card border border-line bg-surface">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="text-body text-ink"><span aria-hidden="true" className="mr-2 inline-block text-ink-2 transition-transform group-open:rotate-90">›</span>{monthName(m)}</span>
                  <span className="text-small tabular-nums text-ink-2">{list.length} {list.length === 1 ? "stub" : "stubs"} · {money(list.reduce((n, x) => n + (x.net ?? 0), 0))} take-home</span>
                </summary>
                <ul className="divide-y divide-line border-t border-line">
                  {list.map((s) => (
                  <li key={s.id}>
                    <Link href={`/private/money/income/stubs/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2"><span className="truncate text-body text-ink">{s.showName || s.employer || s.payrollCompany || "Stub"}</span>{s.estimated && <Tag>Estimate</Tag>}</span>
                        <span className="mt-1 block text-small text-muted">Paid {s.payDate ? shortDate(s.payDate) : "?"} · {replaced.has(s.id) ? "reissued later (counted from the reissue)" : `${round1(workedHours(s))} h`} · {s.depositTxnId ? "in the bank" : s.depositMatch === "none" ? "no deposit" : "not in the bank yet"}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-body tabular-nums">{s.net !== null ? money(s.net) : "–"}</span>
                        <span className="block text-small tabular-nums text-muted">gross {s.gross !== null ? money(s.gross) : "–"}</span>
                      </span>
                    </Link>
                  </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
        {saved.length > 0 && (
          <details className="mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-small text-ink-2 hover:text-ink">Taxes by type, {year}</summary>
            <ul className="mt-2 grid max-w-[480px] gap-1 text-small">
              {TAX_KEYS.map((k) => { const t = saved.reduce((n, s) => n + (s.taxes[k] ?? 0), 0); return t ? <li key={k} className="flex justify-between"><span>{TAX_LABEL[k]}</span><span className="tabular-nums">{money(t)}</span></li> : null; })}
            </ul>
          </details>
        )}
      </section>
    </MoneyShell>
  );
}

function groupByEvent(days: WorkDay[]) {
  const map = new Map<string, { eventId: string; title: string; days: WorkDay[]; late: boolean; expected: number }>();
  for (const d of days) {
    const g = map.get(d.eventId) ?? { eventId: d.eventId, title: d.title, days: [], late: false, expected: 0 };
    g.days.push(d);
    g.late ||= d.late;
    g.expected += d.expected ?? 0;
    map.set(d.eventId, g);
  }
  return [...map.values()].sort((a, b) => a.days[0].day.localeCompare(b.days[0].day));
}


const TOP_EMPLOYERS = 6;
/** The script reports its version in each run's summary; null when it hasn't run yet. */
const scriptVersionOf = (summary: unknown) => { const v = Number((summary as { scriptVersion?: unknown } | null)?.scriptVersion); return Number.isFinite(v) && v > 0 ? v : null; };
const ago = (n: number) => (n <= 0 ? "worked today" : n === 1 ? "worked yesterday" : `worked ${n} days ago`);
const round = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;
