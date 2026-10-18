import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { accountLabel, accountsFor, loadMoney } from "@/lib/money/load";
import { findRecurring, monthlyEquivalent, type Recurring } from "@/tools/money/recurring";
import { isMonth, money, monthName, monthOf, shiftMonth, shortDate, signedMoney, summarize } from "@/tools/money/summary";
import { ChoiceLink, MoneyShell, OWNER_LABEL, Tag } from "@/tools/money/ui/MoneyShell";
import { NotConfigured, NotConnected, Unreachable } from "@/tools/money/ui/Setup";

export const metadata: Metadata = {
  title: "Money",
  description: "Household spending, income and recurring payments.",
  robots: { index: false, follow: false },
};

type Search = Promise<{ month?: string; view?: string; synced?: string }>;
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
  const month = isMonth(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const view = VIEWS.some((v) => v.value === sp.view) ? sp.view! : "all";
  const ids = accountsFor(data.accounts, view);
  const txns = data.txns.filter((t) => ids.has(t.accountId));
  const s = summarize(txns, month);
  const prev = summarize(txns, shiftMonth(month, -1));
  const recurring = findRecurring(txns, data.today);
  const bills = recurring.filter((r) => r.direction === "out" && r.status === "active");
  const paychecks = recurring.filter((r) => r.direction === "in" && r.status === "active");
  const stopped = recurring.filter((r) => r.status === "stopped");
  const billsPerMonth = bills.reduce((n, r) => n + monthlyEquivalent(r), 0);
  const shown = data.accounts.filter((a) => ids.has(a.id));
  const lastRun = data.runs.find((r) => r.ok);
  const maxOut = Math.max(1, ...s.byCategory.map((c) => c.out));
  const qs = (p: Record<string, string>) => {
    const u = new URLSearchParams({ ...(month !== thisMonth ? { month } : {}), ...(view !== "all" ? { view } : {}), ...p });
    for (const [k, v] of [...u.entries()]) if (!v || (k === "month" && v === thisMonth) || (k === "view" && v === "all")) u.delete(k);
    const str = u.toString();
    return `/private/money${str ? `?${str}` : ""}`;
  };

  return (
    <MoneyShell current="/private/money">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-2 pb-6">
        <div>
          <Label>Money</Label>
          <h1 className="mt-3 text-title font-normal">{monthName(month)}</h1>
          <p className="mt-3 text-small text-muted">
            {lastRun ? `Last synced ${new Date(lastRun.startedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Not synced yet"}
            {" · "}
            <Link href="/private/money/settings" className="underline underline-offset-4 hover:text-ink">Sync settings</Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={qs({ month: shiftMonth(month, -1) })} className="flex min-h-11 items-center rounded-btn border border-line-2 bg-surface px-4 text-small text-ink-2 hover:text-ink">
            <span aria-hidden="true">←</span><span className="sr-only">Previous month</span><span aria-hidden="true" className="ml-2 hidden sm:inline">{monthName(shiftMonth(month, -1)).split(" ")[0]}</span>
          </Link>
          {month < thisMonth && (
            <Link href={qs({ month: shiftMonth(month, 1) })} className="flex min-h-11 items-center rounded-btn border border-line-2 bg-surface px-4 text-small text-ink-2 hover:text-ink">
              <span aria-hidden="true" className="mr-2 hidden sm:inline">{monthName(shiftMonth(month, 1)).split(" ")[0]}</span><span className="sr-only">Next month</span><span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>

      {sp.synced && <p className="mt-6"><State kind="ok">Connected and synced.</State></p>}
      {!data.connected && <div className="mt-8"><NotConnected /></div>}

      <div role="group" aria-label="Which accounts" className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
        {VIEWS.map((v) => <ChoiceLink key={v.value} href={qs({ view: v.value })} on={view === v.value}>{v.label}</ChoiceLink>)}
      </div>

      <section aria-label="Totals" className="mt-6 grid gap-4 sm:grid-cols-3">
        <Total label="Money in" value={`+${money(s.moneyIn)}`} note={`${signedDelta(s.moneyIn - prev.moneyIn)} vs last month`} />
        <Total label="Money out" value={`−${money(s.moneyOut)}`} note={`${signedDelta(s.moneyOut - prev.moneyOut)} vs last month`} />
        <Total label="Net" value={signedMoney(s.net)} note={s.net >= 0 ? "Ahead this month" : "Behind this month"} />
      </section>
      <p className="mt-3 text-small text-muted">Transfers between your own accounts aren’t counted as money in or out.</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="cats">
          <h2 id="cats" className="text-h2 font-normal">Where it went</h2>
          {s.byCategory.filter((c) => c.out > 0).length === 0 ? (
            <p className="mt-4 text-body text-ink-2">No spending recorded for {monthName(month)}.</p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {s.byCategory.filter((c) => c.out > 0).map((c) => (
                <li key={c.category}>
                  <Link href={`/private/money/transactions?${new URLSearchParams({ month, category: c.category, ...(view !== "all" ? { view } : {}) })}`} className="group block rounded-btn px-1 py-1 hover:bg-surface-2">
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
          )}
        </section>

        <section aria-labelledby="accts">
          <h2 id="accts" className="text-h2 font-normal">Accounts</h2>
          {shown.length === 0 ? (
            <p className="mt-4 text-body text-ink-2">{data.accounts.length ? "No accounts in this view. Set owners in Settings." : "No accounts yet."}</p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {shown.map((a) => (
                <li key={a.id}>
                  <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
                    <span className="min-w-0">
                      <span className="block truncate text-body text-ink">{accountLabel(a)}</span>
                      <span className="mt-1 flex gap-2">{a.owner ? <Tag>{OWNER_LABEL[a.owner]}</Tag> : <Tag>Owner not set</Tag>}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-h3 tabular-nums">{a.balance === null ? "–" : `${a.balance < 0 ? "−" : ""}${money(a.balance)}`}</span>
                      {a.availableBalance !== null && a.availableBalance !== a.balance && (
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
            <RecurringList title="Bills and subscriptions" items={bills} empty="None found yet." />
            <div className="grid content-start gap-8">
              <RecurringList title="Income" items={paychecks} empty="No regular income found yet." />
              {stopped.length > 0 && <RecurringList title="May have stopped" items={stopped} empty="" />}
            </div>
          </div>
        )}
      </section>
    </MoneyShell>
  );
}

function signedDelta(n: number) {
  if (Math.abs(n) < 0.005) return "Same";
  return `${n > 0 ? "+" : "−"}${money(n)}`;
}

function Total({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <p className="font-mono text-label uppercase text-ink-2">{label}</p>
      <p className="mt-2 text-title font-normal tabular-nums">{value}</p>
      <p className="mt-1 text-small tabular-nums text-muted">{note}</p>
    </Card>
  );
}

function RecurringList({ title, items, empty }: { title: string; items: Recurring[]; empty: string }) {
  return (
    <div>
      <h3 className="text-h3 font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-body text-ink-2">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {items.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-body text-ink">{r.name}</span>
                <span className="mt-1 block text-small text-muted">
                  {r.cadence[0].toUpperCase() + r.cadence.slice(1)} · {r.status === "active" ? `next about ${shortDate(r.next)}` : `last ${shortDate(r.last)}`}
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
