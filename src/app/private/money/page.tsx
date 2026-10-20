import type { Metadata } from "next";
import Link from "next/link";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { accountLabel, accountsFor, acrossFor, loadMoney } from "@/lib/money/load";
import { addDays, findRecurring, monthlyEquivalent, type Recurring } from "@/tools/money/recurring";
import { isMonth, isYear, money, monthName, monthOf, monthsOf, shiftMonth, shortDate, signedMoney, summarize, incomeSources } from "@/tools/money/summary";
import { InOutChart } from "@/tools/money/ui/Charts";
import { StatTile } from "@/tools/money/ui/StatTile";
import { ChoiceLink, MoneyShell, OWNER_LABEL, Tag } from "@/tools/money/ui/MoneyShell";
import { NotConfigured, NotConnected, Unreachable } from "@/tools/money/ui/Setup";

export const metadata: Metadata = {
  title: "Money",
  description: "Household spending, income and recurring payments.",
  robots: { index: false, follow: false },
};

type Search = Promise<{ month?: string; year?: string; view?: string; synced?: string }>;
const VIEWS = [
  { value: "all", label: "Everything" },
  { value: "mine", label: "Mine" },
  { value: "joint", label: "Joint" },
] as const;

export default async function MoneyOverview({ searchParams }: { searchParams: Search }) {
  await requirePrivate("/private/money");
  const sp = await searchParams;
  const data = await loadMoney();

  if (data.state !== "ok") {
    return (
      <MoneyShell current="/private/money">
        <h1 className="text-title font-normal">Money</h1>
        <div className="mt-8">{data.state === "not-configured" ? <NotConfigured /> : <Unreachable />}</div>
      </MoneyShell>
    );
  }

  const thisMonth = monthOf(data.today);
  const thisYear = thisMonth.slice(0, 4);
  // ?year=2026 is the whole year; otherwise ?month=2026-09, defaulting to this month.
  const mode: "year" | "month" = isYear(sp.year) && sp.year <= thisYear && !sp.month ? "year" : "month";
  const month = isMonth(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const year = mode === "year" ? sp.year! : month.slice(0, 4);
  const period = mode === "year" ? year : month;
  const prevPeriod = mode === "year" ? String(Number(year) - 1) : shiftMonth(month, -1);
  const prevName = mode === "year" ? prevPeriod : monthName(prevPeriod).split(" ")[0];
  const view = VIEWS.some((v) => v.value === sp.view) ? sp.view! : "all";
  const ids = accountsFor(data.accounts, view);
  const txns = data.txns.filter((t) => ids.has(t.accountId));
  // Mine → Joint counts as money out of Mine and into Joint (owner's rule, docs/MONEY.md).
  const across = acrossFor(data.accounts, data.txns, view, ids);
  const s = summarize(txns, period, undefined, across);
  const prev = summarize(txns, prevPeriod, undefined, across);
  const yearMonths = monthsOf(year, thisMonth).map((m) => summarize(txns, m, undefined, across));
  const withData = yearMonths.filter((m) => m.count > 0);
  const avgOut = withData.length ? withData.reduce((n, m) => n + m.moneyOut, 0) / withData.length : 0;
  const avgIn = withData.length ? withData.reduce((n, m) => n + m.moneyIn, 0) / withData.length : 0;
  const maxMonthOut = Math.max(1, ...yearMonths.map((m) => m.moneyOut));
  const firstYear = data.txns.reduce((y, t) => (t.posted.slice(0, 4) < y ? t.posted.slice(0, 4) : y), thisYear);
  // At least the last three years, so an older year can be picked (and filled by an import).
  const years = Array.from({ length: Number(thisYear) - Math.min(Number(firstYear), Number(thisYear) - 2) + 1 }, (_, i) => String(Math.min(Number(firstYear), Number(thisYear) - 2) + i));
  const sources = incomeSources(txns, period, across);
  const sourcesTotal = sources.reduce((n, x) => n + x.amount, 0);
  const recurring = findRecurring(txns, data.today, across);
  // The chart: the year's months, or the 12 months up to the one shown.
  const chartMonths = mode === "year"
    ? Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).filter((m) => m <= thisMonth)
    : Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const chart = chartMonths.map((m) => {
    const x = summarize(txns, m, undefined, across);
    return { month: m, label: monthName(m).slice(0, 3), moneyIn: x.moneyIn, moneyOut: Math.max(0, x.moneyOut), current: mode === "month" && m === month, empty: x.count === 0 };
  });
  const bills = recurring.filter((r) => r.direction === "out" && r.status === "active");
  // Pay doesn't come on a schedule (freelance work), so recurring is about bills; pay lives on Income.
  // Bills that ended long ago (last seen over four months back) aren't news; recent gaps are.
  const stopped = recurring.filter((r) => r.status === "stopped" && r.direction === "out" && r.last >= addDays(data.today, -STOPPED_WITHIN_DAYS));
  const billsPerMonth = bills.reduce((n, r) => n + monthlyEquivalent(r), 0);
  const shown = data.accounts.filter((a) => ids.has(a.id));
  const lastRun = data.runs.find((r) => r.ok);
  const maxOut = Math.max(1, ...s.byCategory.map((c) => c.out));
  /** A link to the overview. Pass `month` or `year` to change the period; the view is kept. */
  const qs = (p: { month?: string; year?: string; view?: string }) => {
    const u = new URLSearchParams();
    const v = p.view ?? view;
    if (p.year) u.set("year", p.year);
    else if (p.month) { if (p.month !== thisMonth) u.set("month", p.month); }
    else if (mode === "year") u.set("year", year);
    else if (month !== thisMonth) u.set("month", month);
    if (v !== "all") u.set("view", v);
    const str = u.toString();
    return `/private/money${str ? `?${str}` : ""}`;
  };
  // Stepping a year keeps the same month (clamped to this month) in month mode.
  const yearHref = (y: string) => (mode === "year" ? qs({ year: y }) : qs({ month: `${y}-${month.slice(5)}` > thisMonth ? thisMonth : `${y}-${month.slice(5)}` }));

  return (
    <MoneyShell current="/private/money">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-2 pb-6">
        <div>
          <Label>Money</Label>
          <h1 className="mt-3 text-title font-normal">{mode === "year" ? year : monthName(month)}</h1>
          <p className="mt-3 text-small text-muted">
            {lastRun ? `Last synced ${new Date(lastRun.startedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Not synced yet"}
            {" · "}
            <Link href="/private/money/settings" className="underline underline-offset-4 hover:text-ink">Sync settings</Link>
          </p>
        </div>
        <div role="group" aria-label="Show a month or a year" className="inline-flex gap-1 rounded-full border border-line bg-surface p-1">
          <ChoiceLink href={qs({ month: year === thisYear ? (mode === "month" ? month : thisMonth) : `${year}-12` })} on={mode === "month"}>Month</ChoiceLink>
          <ChoiceLink href={qs({ year })} on={mode === "year"}>Year</ChoiceLink>
        </div>
      </div>

      {mode === "year" ? (
        <nav aria-label="Years" className="mt-6">
          <ul className="flex flex-wrap gap-1">
            {years.map((y) => (
              <li key={y}>
                <Link href={qs({ year: y })} aria-current={y === year ? "true" : undefined} className={y === year ? CHIP_ON : CHIP}>{y}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <nav aria-label="Months" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="flex items-center gap-1">
            {year > years[0] ? (
              <Link href={yearHref(String(Number(year) - 1))} className={STEP}>
                <span aria-hidden="true">←</span><span className="sr-only">{Number(year) - 1}</span>
              </Link>
            ) : <span className="min-w-11" />}
            <span className="min-w-[5ch] text-center text-body tabular-nums text-ink">{year}</span>
            {year < thisYear ? (
              <Link href={yearHref(String(Number(year) + 1))} className={STEP}>
                <span aria-hidden="true">→</span><span className="sr-only">{Number(year) + 1}</span>
              </Link>
            ) : <span className="min-w-11" />}
          </span>
          <ul className="flex flex-wrap gap-1">
            {Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).map((m) => {
              const label = monthName(m).split(" ")[0].slice(0, 3);
              const on = m === month;
              return (
                <li key={m}>
                  {m > thisMonth ? (
                    <span aria-disabled="true" className="flex min-h-10 min-w-12 items-center justify-center rounded-full px-3 text-small text-muted"><span className="sr-only">{monthName(m)}, not yet</span><span aria-hidden="true">{label}</span></span>
                  ) : (
                    <Link href={qs({ month: m })} aria-current={on ? "true" : undefined} className={on ? CHIP_ON : CHIP}>
                      <span className="sr-only">{monthName(m)}</span><span aria-hidden="true">{label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {sp.synced && <p className="mt-6"><State kind="ok">Connected and synced.</State></p>}
      {!data.connected && <div className="mt-8"><NotConnected /></div>}

      <div role="group" aria-label="Which accounts" className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
        {VIEWS.map((v) => <ChoiceLink key={v.value} href={qs({ view: v.value })} on={view === v.value}>{v.label}</ChoiceLink>)}
      </div>

      <section aria-label="Totals" className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Money in" value={`+${money(s.moneyIn)}`} note={mode === "year" ? `About ${money(avgIn)} a month` : prev.count ? delta(s.moneyIn - prev.moneyIn, prevName) : `No data for ${prevName}`} />
        <StatTile label="Money out" value={`−${money(s.moneyOut)}`} note={mode === "year" ? `About ${money(avgOut)} a month` : prev.count ? delta(s.moneyOut - prev.moneyOut, prevName) : `No data for ${prevName}`} />
        <StatTile label="Net" value={signedMoney(s.net)} note={`${s.net >= 0 ? "Ahead" : "Behind"} this ${mode}`} />
      </section>
      <p className="mt-3 text-small text-muted">Transfers between your own accounts aren’t counted as money in or out. In the Mine and Joint views, money moved between the two is.{mode === "year" && withData.length < yearMonths.length ? ` ${yearMonths.length - withData.length} ${yearMonths.length - withData.length === 1 ? "month has" : "months have"} no data yet; older months can be imported in Settings.` : ""}</p>

      <section aria-label="Money in and out by month" className="mt-10 min-w-0">
        <InOutChart points={chart} title={mode === "year" ? `${year} by month` : "Last 12 months"} />
        {mode === "month" && (
          <details className="mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-small text-ink-2 hover:text-ink">Show as a table</summary>
            <table className="mt-2 w-full text-small">
              <thead><tr className="border-b border-line text-left text-ink-2"><th scope="col" className="py-1.5 font-normal">Month</th><th scope="col" className="py-1.5 text-right font-normal">In</th><th scope="col" className="py-1.5 text-right font-normal">Out</th></tr></thead>
              <tbody className="divide-y divide-line">
                {chart.map((c) => (
                  <tr key={c.month}><th scope="row" className="py-1.5 text-left font-normal">{monthName(c.month)}</th>{c.empty ? <td colSpan={2} className="py-1.5 text-right text-muted">No data</td> : <><td className="py-1.5 text-right tabular-nums">+{money(c.moneyIn)}</td><td className="py-1.5 text-right tabular-nums">−{money(c.moneyOut)}</td></>}</tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      {mode === "year" && (
        <section aria-labelledby="months" className="mt-10 min-w-0">
          <h2 id="months" className="text-h2 font-normal">Month by month</h2>
          <div className="relative mt-4 overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-line text-left text-small text-ink-2">
                  <th scope="col" className="py-2 pr-4 font-normal">Month</th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal sm:pr-4">In</th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal sm:pr-4">Out</th>
                  <th scope="col" className="py-2 text-right font-normal sm:pr-4">Net</th>
                  <td aria-hidden="true" className="hidden sm:table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {yearMonths.map((m) => (
                  <tr key={m.month}>
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      <Link href={qs({ month: m.month })} className="text-ink underline-offset-4 hover:underline"><span className="sm:hidden">{monthName(m.month).slice(0, 3)}</span><span className="hidden sm:inline">{monthName(m.month).split(" ")[0]}</span></Link>
                    </th>
                    {m.count === 0 ? (
                      <td colSpan={4} className="py-2 text-right text-small text-muted sm:text-left">No data</td>
                    ) : (
                      <>
                        <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap sm:pr-4">+{money(m.moneyIn)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap sm:pr-4">−{money(m.moneyOut)}</td>
                        <td className="py-2 text-right tabular-nums whitespace-nowrap sm:pr-4">{signedMoney(m.net)}</td>
                        <td className="hidden w-[30%] py-2 sm:table-cell" aria-hidden="true">
                          <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <span className="block h-full rounded-full bg-ice" style={{ width: `${Math.max(2, (m.moneyOut / maxMonthOut) * 100)}%` }} />
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="cats" className="min-w-0">
          <h2 id="cats" className="text-h2 font-normal">Where it went</h2>
          {s.byCategory.filter((c) => c.out > 0).length === 0 ? (
            <p className="mt-4 text-body text-ink-2">No spending recorded for {mode === "year" ? year : monthName(month)}.</p>
          ) : (
            <>
            <ul className="mt-5 grid gap-3">
              {s.byCategory.filter((c) => c.out > 0).slice(0, TOP_CATEGORIES).map((c) => (
                <li key={c.category}>
                  <Link href={`/private/money/transactions?${new URLSearchParams({ month: period, category: c.category, ...(view !== "all" ? { view } : {}) })}`} className="group block rounded-btn px-1 py-1 hover:bg-surface-2">
                    <span className="flex items-baseline justify-between gap-4 text-body">
                      <span className="text-ink group-hover:underline group-hover:underline-offset-4">{c.category}</span>
                      <span className="tabular-nums text-ink">{money(c.out)}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-3">
                      <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-ice" style={{ width: `${Math.max(2, (c.out / maxOut) * 100)}%` }} />
                      </span>
                      <span className="w-[13ch] text-right text-small tabular-nums text-muted">{Math.round((c.out / s.moneyOut) * 100)}% · {c.count} {c.count === 1 ? "item" : "items"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {s.byCategory.filter((c) => c.out > 0).length > TOP_CATEGORIES && (
              <details className="mt-2">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-small text-ink-2 hover:text-ink">Show {s.byCategory.filter((c) => c.out > 0).length - TOP_CATEGORIES} more</summary>
                <ul className="mt-2 grid gap-3">
                  {s.byCategory.filter((c) => c.out > 0).slice(TOP_CATEGORIES).map((c) => (
                <li key={c.category}>
                  <Link href={`/private/money/transactions?${new URLSearchParams({ month: period, category: c.category, ...(view !== "all" ? { view } : {}) })}`} className="group block rounded-btn px-1 py-1 hover:bg-surface-2">
                    <span className="flex items-baseline justify-between gap-4 text-body">
                      <span className="text-ink group-hover:underline group-hover:underline-offset-4">{c.category}</span>
                      <span className="tabular-nums text-ink">{money(c.out)}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-3">
                      <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-ice" style={{ width: `${Math.max(2, (c.out / maxOut) * 100)}%` }} />
                      </span>
                      <span className="w-[13ch] text-right text-small tabular-nums text-muted">{Math.round((c.out / s.moneyOut) * 100)}% · {c.count} {c.count === 1 ? "item" : "items"}</span>
                    </span>
                  </Link>
                </li>
                  ))}
                </ul>
              </details>
            )}
            </>
          )}
        </section>

        <section aria-labelledby="income" className="min-w-0 lg:col-start-1">
          <h2 id="income" className="text-h2 font-normal">Where it came from</h2>
          {sources.length === 0 ? (
            <p className="mt-4 text-body text-ink-2">No money in recorded for {mode === "year" ? year : monthName(month)}.</p>
          ) : (
            <ul className="mt-5 divide-y divide-line rounded-card border border-line bg-surface">
              {sources.slice(0, 12).map((x) => (
                <li key={x.key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-body text-ink">{x.name}</span>
                    <span className="mt-1 block text-small text-muted">{x.count} {x.count === 1 ? "deposit" : "deposits"} · {Math.round((x.amount / sourcesTotal) * 100)}%{x.category && x.category !== "Income" ? ` · ${x.category === "Transfer" ? "moved in" : x.category}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-right text-body tabular-nums">+{money(x.amount)}</span>
                </li>
              ))}
              {sources.length > 12 && <li className="px-4 py-3 text-small text-muted">{sources.length - 12} smaller sources not shown</li>}
            </ul>
          )}
        </section>

        <section aria-labelledby="accts" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <h2 id="accts" className="text-h2 font-normal">Accounts</h2>
          {shown.length === 0 ? (
            <p className="mt-4 text-body text-ink-2">{data.accounts.length ? "No accounts in this view. Set owners in Settings." : "No accounts yet."}</p>
          ) : (
            <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3">
              {shown.map((a) => (
                <li key={a.id}>
                  <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
                    <span className="min-w-0">
                      <span className="block truncate text-body text-ink">{accountLabel(a)}</span>
                      <span className="mt-1 flex gap-2">{a.owner ? <Tag>{OWNER_LABEL[a.owner]}</Tag> : <Tag>Owner not set</Tag>}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-h3 tabular-nums">{a.balance === null ? "–" : `${a.balance < 0 ? "−" : ""}${money(a.balance)}`}</span>
                      {/* Savings and cards report $0 available when the bank doesn't give one: not news. */}
                      {a.availableBalance !== null && a.availableBalance !== 0 && a.availableBalance !== a.balance && (
                        <span className="block text-small tabular-nums text-muted">{money(a.availableBalance)} available</span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="rec" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="rec" className="text-h2 font-normal">Recurring</h2>
          {bills.length > 0 && <p className="text-body text-ink-2">About <span className="tabular-nums text-ink">{money(billsPerMonth)}</span> a month in bills and subscriptions</p>}
        </div>
        {recurring.length === 0 ? (
          <p className="mt-4 max-w-[60ch] text-body text-ink-2">Nothing found yet. A monthly charge shows up here after it’s been seen three times, so give it a few months of history.</p>
        ) : (
          <div className="mt-5 grid gap-8 lg:grid-cols-2">
            <RecurringList title="Bills and subscriptions" items={bills} empty="None found yet." today={data.today} />
            <div className="grid min-w-0 content-start gap-8">
              {stopped.length > 0 ? <RecurringList title="May have stopped" items={stopped} empty="" note="Not seen for more than half a cycle, in the last four months." today={data.today} /> : <p className="text-body text-ink-2">Every bill has shown up when expected.</p>}
              <p className="text-small text-muted">Pay isn&rsquo;t listed here: it doesn&rsquo;t come on a schedule. Stubs, what you&rsquo;ve been paid and pay still owed are on <Link href="/private/money/income" className="underline underline-offset-4 hover:text-ink">Income</Link>.</p>
            </div>
          </div>
        )}
      </section>
    </MoneyShell>
  );
}

/** "May have stopped" lists bills last seen within this many days. */
const STOPPED_WITHIN_DAYS = 120;
/** Categories shown before "Show more" in Where it went. */
const TOP_CATEGORIES = 8;
const CHIP = "flex min-h-10 min-w-12 items-center justify-center rounded-full border border-line px-3 text-small tabular-nums text-ink-2 hover:text-ink";
const CHIP_ON = "flex min-h-10 min-w-12 items-center justify-center rounded-full bg-primary px-3 text-small tabular-nums text-on-primary";
const STEP = "flex min-h-11 min-w-11 items-center justify-center rounded-btn border border-line-2 bg-surface text-small text-ink-2 hover:text-ink";

/** "$188.39 less than August": words, not a sign the reader has to decode. */
function delta(n: number, prevMonth: string) {
  if (Math.abs(n) < 0.005) return `Same as ${prevMonth}`;
  return `${money(n)} ${n > 0 ? "more" : "less"} than ${prevMonth}`;
}


function RecurringList({ title, items, empty, note, today }: { title: string; items: Recurring[]; empty: string; note?: string; today: string }) {
  return (
    <div className="min-w-0">
      <h3 className="text-h3 font-medium">{title}</h3>
      {note && <p className="mt-1 text-small text-muted">{note}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-body text-ink-2">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {items.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-body text-ink">{r.name}</span>
                <span className="mt-1 block text-small text-muted">
                  {r.cadence[0].toUpperCase() + r.cadence.slice(1)} · {r.status === "active" ? (r.next < today ? `expected about ${shortDate(r.next)}, not in yet` : `next about ${shortDate(r.next)}`) : `last ${shortDate(r.last)}`}
                </span>
              </span>
              <span className="shrink-0 text-right text-body tabular-nums">
                {r.varies && <span className="sr-only">about </span>}
                {r.varies && <span aria-hidden="true">≈</span>}
                {r.direction === "in" ? "+" : "−"}{money(r.typical)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
