import { INCOME_CATEGORIES, INVESTING, TRANSFER } from "./categorize.ts";
import { addDays, monthlyEquivalent, type Recurring } from "./recurring.ts";
import { shiftMonth } from "./summary.ts";
import type { Account, Txn } from "./types.ts";

/**
 * A monthly budget worked out from history, for one view (Everything / Mine / Joint):
 *   bills (the recurring list, at their monthly equivalent, minus savings and investing)
 * + everyday spending (everything else that went out, averaged over recent full months)
 * = what a month needs, set against average money in. Savings and investing are counted apart
 * ("saving"), and what's left over is after both.
 * Refunds net against their category; transfers between the view's own accounts count as
 * neither; a transfer to another owner's account counts as it does on the overview.
 */

export type Budget = {
  months: string[]; // the full months averaged, oldest first
  bills: Array<Recurring & { perMonth: number }>;
  billsPerMonth: number;
  everyday: Array<{ category: string; perMonth: number }>;
  everydayPerMonth: number;
  needPerMonth: number;
  /** Money moved into savings and investments a month: not needed to stay afloat, so kept apart. */
  savingPerMonth: number;
  incomePerMonth: number;
  spare: number; // income − need − saving; negative = short
  cash: number | null; // sum of the view's account balances (cards count against it)
  monthsCovered: number | null; // cash ÷ need
  upcoming: Array<{ name: string; date: string; amount: number }>; // bills due in the next 30 days
};

/**
 * The last (up to) `n` whole months before this one that the data fully covers: a month only
 * counts once the history starts on or before its 3rd (data that starts Jul 21 can't speak for July).
 */
export function fullMonths(txns: readonly Txn[], today: string, n = 3): string[] {
  const first = txns.reduce<string | null>((m, t) => (m === null || t.posted < m ? t.posted : m), null);
  if (!first) return [];
  const out: string[] = [];
  for (let m = shiftMonth(today.slice(0, 7), -1); out.length < n; m = shiftMonth(m, -1)) {
    if (`${m}-03` < first) break;
    out.unshift(m);
  }
  return out;
}

export function buildBudget(
  txns: readonly Txn[],
  recurring: readonly Recurring[],
  accounts: readonly Account[],
  today: string,
  across?: ReadonlyMap<string, string>,
): Budget {
  const months = fullMonths(txns, today);
  const inMonths = (t: Txn) => months.includes(t.posted.slice(0, 7));
  const bills = recurring
    .filter((r) => r.direction === "out" && r.status === "active" && r.category !== INVESTING)
    .map((r) => ({ ...r, perMonth: round(monthlyEquivalent(r)) }))
    .sort((a, b) => b.perMonth - a.perMonth);
  const billIds = new Set(bills.flatMap((b) => b.txnIds));
  let saving = 0;
  const billsPerMonth = round(bills.reduce((n, b) => n + b.perMonth, 0));

  const byCat = new Map<string, number>();
  let income = 0;
  for (const t of txns) {
    if (t.pending || !inMonths(t)) continue;
    const crossing = t.category === TRANSFER ? across?.get(t.id) : undefined;
    if (t.category === TRANSFER && !crossing) continue;
    const c = crossing ?? t.category ?? "Uncategorized";
    if (t.amount > 0 && (crossing || INCOME_CATEGORIES.has(c))) { income += t.amount; continue; }
    if (billIds.has(t.id)) continue; // already counted as a bill
    if (c === INVESTING) { saving -= t.amount; continue; }
    byCat.set(c, (byCat.get(c) ?? 0) - t.amount); // refunds (money in) reduce the category
  }
  const n = Math.max(1, months.length);
  const everyday = [...byCat.entries()]
    .map(([category, total]) => ({ category, perMonth: round(total / n) }))
    .filter((x) => x.perMonth > 0.5)
    .sort((a, b) => b.perMonth - a.perMonth);
  const everydayPerMonth = round(everyday.reduce((s, x) => s + x.perMonth, 0));
  const needPerMonth = round(billsPerMonth + everydayPerMonth);
  const incomePerMonth = months.length ? round(income / n) : 0;
  const savingPerMonth = months.length ? round(saving / n) : 0;

  const balances = accounts.map((a) => a.balance).filter((b): b is number => b !== null);
  const cash = balances.length ? round(balances.reduce((s, b) => s + b, 0)) : null;

  const until = addDays(today, 30);
  const upcoming = bills
    .filter((b) => b.next >= today && b.next <= until)
    .map((b) => ({ name: b.name, date: b.next, amount: b.typical }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    months, bills, billsPerMonth, everyday, everydayPerMonth, needPerMonth, savingPerMonth, incomePerMonth,
    spare: round(incomePerMonth - needPerMonth - savingPerMonth),
    cash,
    monthsCovered: cash !== null && needPerMonth > 0 ? Math.round((cash / needPerMonth) * 10) / 10 : null,
    upcoming,
  };
}

const round = (x: number) => Math.round(x * 100) / 100;
