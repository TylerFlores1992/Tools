import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Label } from "@/components/Label";
import { requirePrivate } from "@/lib/money/guard";
import { accountLabel, accountsFor, loadMoney } from "@/lib/money/load";
import { CATEGORIES } from "@/tools/money/categorize";
import { merchantKey } from "@/tools/money/recurring";
import { isMonth, money, monthName, monthOf, shiftMonth, shortDate } from "@/tools/money/summary";
import type { Txn } from "@/tools/money/types";
import { MoneyShell, Tag } from "@/tools/money/ui/MoneyShell";
import { NotConfigured, NotConnected, Unreachable } from "@/tools/money/ui/Setup";
import { recategorize } from "../actions";

export const metadata: Metadata = {
  title: "Transactions · Money",
  description: "Every transaction, filterable.",
  robots: { index: false, follow: false },
};

type Search = Promise<{ month?: string; view?: string; account?: string; category?: string; q?: string }>;

const SOURCE_WORD = { manual: "Set by you", rule: "Your rule", auto: "Automatic" } as const;

export default async function Transactions({ searchParams }: { searchParams: Search }) {
  await requirePrivate("/private/money/transactions");
  const sp = await searchParams;
  const data = await loadMoney();

  if (data.state !== "ok") {
    return (
      <MoneyShell current="/private/money/transactions">
        <h1 className="text-title font-normal">Transactions</h1>
        <div className="mt-8">{data.state === "not-configured" ? <NotConfigured /> : <Unreachable />}</div>
      </MoneyShell>
    );
  }

  const thisMonth = monthOf(data.today);
  const month = isMonth(sp.month) ? sp.month : sp.month === "all" ? "all" : thisMonth;
  const view = sp.view === "mine" || sp.view === "joint" ? sp.view : "all";
  const ids = accountsFor(data.accounts, view);
  const account = data.accounts.find((a) => a.id === sp.account);
  const category = (CATEGORIES as readonly string[]).includes(sp.category ?? "") ? sp.category! : "";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const needle = q.toUpperCase();

  const rows = data.txns.filter((t) =>
    ids.has(t.accountId) &&
    (!account || t.accountId === account.id) &&
    (month === "all" || monthOf(t.posted) === month) &&
    (!category || t.category === category) &&
    (!needle || `${t.description} ${t.payee ?? ""} ${t.memo ?? ""}`.toUpperCase().includes(needle)),
  );
  const outTotal = rows.filter((t) => t.amount < 0).reduce((n, t) => n - t.amount, 0);
  const inTotal = rows.filter((t) => t.amount > 0).reduce((n, t) => n + t.amount, 0);
  const byDay = new Map<string, Txn[]>();
  for (const t of rows) (byDay.get(t.posted) ?? byDay.set(t.posted, []).get(t.posted)!).push(t);
  const names = new Map(data.accounts.map((a) => [a.id, accountLabel(a)]));
  const months = Array.from({ length: 13 }, (_, i) => shiftMonth(thisMonth, -i));

  return (
    <MoneyShell current="/private/money/transactions">
      <Label>Money</Label>
      <h1 className="mt-3 text-title font-normal">Transactions</h1>
      {!data.connected && <div className="mt-8"><NotConnected /></div>}

      <form method="get" className="mt-8 grid gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto] lg:items-end">
        <Field label="Month">
          <select name="month" defaultValue={month} className={SELECT}>
            {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            <option value="all">Last 13 months</option>
          </select>
        </Field>
        <Field label="Account">
          <select name="account" defaultValue={account?.id ?? ""} className={SELECT}>
            <option value="">All accounts</option>
            {data.accounts.filter((a) => !a.hidden).map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={category} className={SELECT}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Search">
          <input name="q" type="search" defaultValue={q} placeholder="Merchant or memo" className={`${SELECT} placeholder:text-muted`} />
        </Field>
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <Button type="submit" variant="quiet">Filter</Button>
      </form>

      <p className="mt-5 text-small tabular-nums text-ink-2" aria-live="polite">
        {rows.length} {rows.length === 1 ? "transaction" : "transactions"} · {`−${money(outTotal)}`} out · {`+${money(inTotal)}`} in, transfers included
        {(category || q || account || month !== thisMonth) && (
          <> · <Link href="/private/money/transactions" className="underline underline-offset-4 hover:text-ink">Clear filters</Link></>
        )}
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-body text-ink-2">No transactions match.</p>
      ) : (
        <div className="mt-6 grid gap-6">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day} aria-label={shortDate(day)}>
              <h2 className="font-mono text-label uppercase text-muted">{shortDate(day)}</h2>
              <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
                {list.map((t) => <Row key={t.id} t={t} account={names.get(t.accountId) ?? ""} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </MoneyShell>
  );
}

const SELECT = "field min-h-11 w-full rounded-input border border-control bg-surface px-3 text-body text-ink";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-small text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function Row({ t, account }: { t: Txn; account: string }) {
  const merchant = merchantKey(t.payee || t.description);
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-words text-body text-ink">{t.payee || t.description}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
            <span>{t.category ?? "Uncategorized"}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{account}</span>
            {t.pending && <Tag>Pending</Tag>}
          </p>
        </div>
        <p className="shrink-0 text-body tabular-nums text-ink">
          <span className="sr-only">{t.amount < 0 ? "Money out:" : "Money in:"} </span>
          {t.amount < 0 ? "−" : "+"}{money(t.amount)}
        </p>
      </div>
      <details className="group mt-2">
        <summary className="inline-flex min-h-9 cursor-pointer items-center rounded-btn px-1 text-small text-ink-2 hover:text-ink">
          Change category<span className="sr-only"> for {t.payee || t.description}</span>
        </summary>
        <form action={recategorize} className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr_auto] sm:items-center">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="description" value={t.payee || t.description} />
          <label className="grid gap-1">
            <span className="sr-only">Category</span>
            <select name="category" defaultValue={t.category ?? ""} className={SELECT}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {merchant.length >= 3 ? (
            <label className="flex min-h-11 items-center gap-3 text-small text-ink-2">
              <input type="checkbox" name="always" className="size-5 accent-ink" />
              <span>Always file “{merchant}” this way</span>
            </label>
          ) : <span />}
          <Button type="submit" variant="quiet">Save</Button>
        </form>
        {t.categorySource && <p className="mt-2 text-small text-muted">Current: {SOURCE_WORD[t.categorySource]}.{t.memo ? ` Memo: ${t.memo}` : ""}</p>}
      </details>
    </li>
  );
}
