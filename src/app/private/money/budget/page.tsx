import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { requirePrivate } from "@/lib/money/guard";
import { accountsFor, acrossFor, loadMoney } from "@/lib/money/load";
import { buildBudget } from "@/tools/money/budget";
import { findRecurring } from "@/tools/money/recurring";
import { money, monthName, shortDate, signedMoney } from "@/tools/money/summary";
import { NeedBar } from "@/tools/money/ui/Charts";
import { ChoiceLink, MoneyShell } from "@/tools/money/ui/MoneyShell";
import { NotConfigured, Unreachable } from "@/tools/money/ui/Setup";

export const metadata: Metadata = {
  title: "Budget · Money",
  description: "What a month needs: bills plus everyday spending, against what comes in.",
  robots: { index: false, follow: false },
};

const VIEWS = [
  { value: "all", label: "Everything" },
  { value: "mine", label: "Mine" },
  { value: "joint", label: "Joint" },
] as const;

export default async function MoneyBudget({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePrivate("/private/money/budget");
  const sp = await searchParams;
  const data = await loadMoney();

  if (data.state !== "ok") {
    return (
      <MoneyShell current="/private/money/budget">
        <h1 className="text-title font-normal">Budget</h1>
        <div className="mt-8">{data.state === "not-configured" ? <NotConfigured /> : <Unreachable />}</div>
      </MoneyShell>
    );
  }

  const view = VIEWS.some((v) => v.value === sp.view) ? sp.view! : "all";
  const ids = accountsFor(data.accounts, view);
  const txns = data.txns.filter((t) => ids.has(t.accountId));
  const across = acrossFor(data.accounts, data.txns, view, ids);
  const recurring = findRecurring(txns, data.today, across);
  const b = buildBudget(txns, recurring, data.accounts.filter((a) => ids.has(a.id)), data.today, across);
  const maxEveryday = Math.max(1, ...b.everyday.map((x) => x.perMonth));
  const basis = b.months.length
    ? `Averaged over ${b.months.map((m) => monthName(m).split(" ")[0]).join(", ")}${b.months.length < 3 ? ` (only ${b.months.length === 1 ? "one full month" : "two full months"} of history so far; import older months in Settings for a steadier average)` : ""}.`
    : "Not enough history yet: averages need at least one full month. Import older months in Settings.";
  // Cash left after each upcoming bill, in date order.
  const after = b.upcoming.map((_, i) => (b.cash ?? 0) - b.upcoming.slice(0, i + 1).reduce((n, u) => n + u.amount, 0));

  return (
    <MoneyShell current="/private/money/budget">
      <div className="border-b border-line-2 pb-6">
        <Label>Money</Label>
        <h1 className="mt-3 text-title font-normal">Budget</h1>
        <p className="mt-3 max-w-[64ch] text-body text-ink-2">What a month needs to stay afloat: your bills, plus what everyday spending usually comes to, against what usually comes in.</p>
      </div>

      <div role="group" aria-label="Which accounts" className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
        {VIEWS.map((v) => <ChoiceLink key={v.value} href={v.value === "all" ? "/private/money/budget" : `/private/money/budget?view=${v.value}`} on={view === v.value}>{v.label}</ChoiceLink>)}
      </div>

      <section aria-label="Monthly totals" className="mt-6 grid max-w-[960px] gap-4 sm:grid-cols-2">
        <Tile label="Needed each month" value={money(b.needPerMonth)} note={`${money(b.billsPerMonth)} bills + ${money(b.everydayPerMonth)} everyday`} />
        <Tile label="Usually comes in" value={money(b.incomePerMonth)} note="Average money in a month" />
        <Tile
          label={b.spare >= 0 ? "Left over" : "Short"}
          value={signedMoney(b.spare)}
          note={`${b.spare >= 0 ? "A month, on average" : "A month, on average: more goes out than comes in"}${b.savingPerMonth > 0 ? `, after ${money(b.savingPerMonth)} to savings and investing` : ""}`}
        />
        <Tile
          label="Cash on hand"
          value={b.cash === null ? "–" : `${b.cash < 0 ? "−" : ""}${money(b.cash)}`}
          note={b.monthsCovered === null ? "Balances not synced yet" : `Covers about ${b.monthsCovered} ${b.monthsCovered === 1 ? "month" : "months"} of needs (cards count against it)`}
        />
      </section>
      <p className="mt-3 text-small text-muted">{basis}</p>

      <section aria-labelledby="float" className="mt-10 max-w-[860px]">
        <h2 id="float" className="text-h2 font-normal">In vs needed</h2>
        <div className="mt-5"><NeedBar income={b.incomePerMonth} bills={b.billsPerMonth} everyday={b.everydayPerMonth} /></div>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="bills" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="bills" className="text-h2 font-normal">Bills</h2>
            <p className="text-body text-ink-2"><span className="tabular-nums text-ink">{money(b.billsPerMonth)}</span> a month</p>
          </div>
          {b.bills.length === 0 ? (
            <p className="mt-4 text-body text-ink-2">No regular bills found yet in this view.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
              {b.bills.map((x) => (
                <li key={x.key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-body text-ink">{x.name}</span>
                    <span className="mt-1 block text-small text-muted">
                      {x.cadence[0].toUpperCase() + x.cadence.slice(1)}{x.cadence !== "monthly" ? ` · ${money(x.typical)} each` : ""} · next about {shortDate(x.next)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-body tabular-nums">
                    {x.varies && <span className="sr-only">about </span>}
                    {x.varies && <span aria-hidden="true">≈</span>}
                    {money(x.perMonth)}<span className="text-small text-muted">/mo</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="everyday" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="everyday" className="text-h2 font-normal">Everyday spending</h2>
            <p className="text-body text-ink-2"><span className="tabular-nums text-ink">{money(b.everydayPerMonth)}</span> a month</p>
          </div>
          <p className="mt-2 text-small text-muted">Everything else that went out, per month on average. Refunds are taken off.</p>
          {b.everyday.length === 0 ? (
            <p className="mt-4 text-body text-ink-2">Nothing yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {b.everyday.map((c) => (
                <li key={c.category}>
                  <Link href={`/private/money/transactions?${new URLSearchParams({ category: c.category, month: "all", ...(view !== "all" ? { view } : {}) })}`} className="group block rounded-btn px-1 py-1 hover:bg-surface-2">
                    <span className="flex items-baseline justify-between gap-4 text-body">
                      <span className="text-ink group-hover:underline group-hover:underline-offset-4">{c.category}</span>
                      <span className="tabular-nums text-ink">{money(c.perMonth)}</span>
                    </span>
                    <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-series-2" style={{ width: `${Math.max(2, (c.perMonth / maxEveryday) * 100)}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="soon" className="mt-12 max-w-[860px]">
        <h2 id="soon" className="text-h2 font-normal">Coming up in the next 30 days</h2>
        {b.upcoming.length === 0 ? (
          <p className="mt-4 text-body text-ink-2">No bills expected in the next 30 days.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-line text-left text-small text-ink-2">
                  <th scope="col" className="py-2 pr-3 font-normal">Around</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Bill</th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">Amount</th>
                  {b.cash !== null && <th scope="col" className="hidden py-2 text-right font-normal sm:table-cell">Cash left</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {b.upcoming.map((u, i) => {
                  const running = after[i];
                  return (
                    <tr key={`${u.name}-${i}`}>
                      <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{shortDate(u.date)}</td>
                      <td className="max-w-[16ch] truncate py-2 pr-3 sm:max-w-[32ch]">{u.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">−{money(u.amount)}</td>
                      {b.cash !== null && <td className="hidden py-2 text-right tabular-nums whitespace-nowrap sm:table-cell">{running < 0 ? "−" : ""}{money(running)}{running < 0 ? <span className="ml-1 text-small text-muted">short</span> : null}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-small text-muted">Dates are estimates from the last payment. Paychecks aren’t added in, since they don’t come on a schedule.</p>
          </div>
        )}
      </section>
    </MoneyShell>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <p className="font-mono text-label uppercase text-ink-2">{label}</p>
      <p className="mt-2 text-title font-normal tabular-nums">{value}</p>
      <p className="mt-1 text-small text-muted">{note}</p>
    </Card>
  );
}
