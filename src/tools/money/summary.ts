import { TRANSFER } from "./categorize.ts";
import type { Txn } from "./types.ts";

/** Totals for a month. Transfers between the household's own accounts count as neither. */
export type MonthSummary = {
  month: string; // YYYY-MM
  moneyIn: number;
  moneyOut: number; // positive number
  net: number;
  byCategory: Array<{ category: string; out: number; in: number; count: number }>;
  count: number;
};

export const monthOf = (date: string) => date.slice(0, 7);

const round = (n: number) => Math.round(n * 100) / 100;

export function summarize(txns: readonly Txn[], month: string, accountIds?: ReadonlySet<string>): MonthSummary {
  let moneyIn = 0;
  let moneyOut = 0;
  let count = 0;
  const cats = new Map<string, { out: number; in: number; count: number }>();
  for (const t of txns) {
    if (monthOf(t.posted) !== month) continue;
    if (accountIds && !accountIds.has(t.accountId)) continue;
    if (t.category === TRANSFER) continue;
    count++;
    const c = t.category ?? "Uncategorized";
    const row = cats.get(c) ?? { out: 0, in: 0, count: 0 };
    if (t.amount < 0) {
      moneyOut += -t.amount;
      row.out += -t.amount;
    } else {
      moneyIn += t.amount;
      row.in += t.amount;
    }
    row.count++;
    cats.set(c, row);
  }
  const byCategory = [...cats.entries()]
    .map(([category, r]) => ({ category, out: round(r.out), in: round(r.in), count: r.count }))
    .sort((a, b) => b.out - a.out || b.in - a.in);
  return { month, moneyIn: round(moneyIn), moneyOut: round(moneyOut), net: round(moneyIn - moneyOut), byCategory, count };
}

/** YYYY-MM plus `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** True for a well-formed YYYY-MM. */
export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "$1,234.56". Money signs are words or +/−, never colour alone. */
export const money = (n: number) => USD.format(Math.abs(n));

/** "+$12.00" or "−$12.00" (a true minus sign). */
export const signedMoney = (n: number) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${money(n)}`;

export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
