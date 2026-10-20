import { INCOME_CATEGORIES, TRANSFER, matchTransfers } from "./categorize.ts";
import { merchantKey } from "./merchant.ts";
import type { Txn } from "./types.ts";

/**
 * Totals for a month. Transfers between the household's own accounts count as neither, except
 * those in `across` (see transfersAcross): money that left the view for another owner's account
 * counts as money out, and money that arrived from one counts as money in.
 */
export type MonthSummary = {
  month: string; // the period: YYYY-MM, or YYYY for a whole year
  moneyIn: number;
  moneyOut: number; // positive number
  net: number;
  byCategory: Array<{ category: string; out: number; in: number; count: number }>;
  count: number;
};

export const monthOf = (date: string) => date.slice(0, 7);

const round = (n: number) => Math.round(n * 100) / 100;

/** `month` is YYYY-MM for one month, or YYYY for the whole year. */
export function summarize(
  txns: readonly Txn[],
  month: string,
  accountIds?: ReadonlySet<string>,
  across?: ReadonlyMap<string, string>,
): MonthSummary {
  let moneyIn = 0;
  let moneyOut = 0;
  let count = 0;
  const cats = new Map<string, { out: number; in: number; count: number }>();
  for (const t of txns) {
    if (!t.posted.startsWith(month)) continue;
    if (accountIds && !accountIds.has(t.accountId)) continue;
    const crossing = t.category === TRANSFER ? across?.get(t.id) : undefined;
    if (t.category === TRANSFER && !crossing) continue;
    count++;
    const c = crossing ?? t.category ?? "Uncategorized";
    const row = cats.get(c) ?? { out: 0, in: 0, count: 0 };
    if (t.amount < 0) {
      moneyOut += -t.amount;
      row.out += -t.amount;
    } else if (!crossing && !INCOME_CATEGORIES.has(c)) {
      // A refund: less spent in that category, not money earned.
      moneyOut -= t.amount;
      row.out -= t.amount;
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

/**
 * Transfers that cross the edge of a view: one side in `inView`, the other in a household account
 * outside it (Mine → Joint, say). Owner's rule (2026-10-18): money he moves into the joint account
 * pays the bills, so in the Mine view it is money out, and in the Joint view money in. Everything
 * still counts it as neither, or it would be counted twice (once moved, once spent). Returns
 * transaction id → the category to show, e.g. "Transfer to Joint". Unmatched transfers (the
 * other side isn't a connected account) stay uncounted.
 */
export function transfersAcross(
  all: readonly Txn[],
  inView: ReadonlySet<string>,
  ownerName: (accountId: string) => string,
): Map<string, string> {
  const byId = new Map(all.map((t) => [t.id, t]));
  const out = new Map<string, string>();
  for (const [id, otherId] of matchTransfers(all.filter((t) => t.category === TRANSFER))) {
    const t = byId.get(id)!;
    const o = byId.get(otherId)!;
    if (!inView.has(t.accountId) || inView.has(o.accountId)) continue;
    out.set(id, `Transfer ${t.amount < 0 ? "to" : "from"} ${ownerName(o.accountId)}`);
  }
  return out;
}

export type IncomeSource = { key: string; name: string; amount: number; count: number; category: string };

/**
 * Money in for a period, grouped by who paid it (payroll company, check deposits, a transfer from
 * the other owner's accounts), largest first. Gig income comes from many payrolls on no fixed
 * schedule, so this, not the Recurring list, is where income shows up. Pending deposits count, as
 * they do in the Money in total (`summarize`), so the shares add up to that total.
 */
export function incomeSources(txns: readonly Txn[], period: string, across?: ReadonlyMap<string, string>): IncomeSource[] {
  const map = new Map<string, IncomeSource>();
  for (const t of [...txns].sort((a, b) => a.posted.localeCompare(b.posted))) {
    if (t.amount <= 0 || !t.posted.startsWith(period)) continue;
    const crossing = t.category === TRANSFER ? across?.get(t.id) : undefined;
    if (t.category === TRANSFER && !crossing) continue;
    if (!crossing && !INCOME_CATEGORIES.has(t.category ?? "")) continue; // a refund, not income
    // Name by the description up to its first reference number ("External Transfer Deposit
    // F40381ba72d9779" and "… S10c10f9de3147f" are one payer), falling back to the payee.
    const plain = t.description.split(/\s+/).filter((w, i, all) => !all.slice(0, i + 1).some((x) => /\d/.test(x))).join(" ");
    let key = crossing ?? (merchantKey(plain) || merchantKey(t.payee || t.description));
    let name = crossing ?? (merchantKey(plain) ? tidyName(plain) : (t.payee || t.description).trim());
    if (!crossing && /\bDEPOSIT\b/.test(key) && /\b(CHECK|REMOTE|ONLINE|MOBILE)\b/.test(normalizeKey(t.description))) { key = "check deposits"; name = "Check deposits"; }
    const row = map.get(key) ?? { key, name, amount: 0, count: 0, category: crossing ? TRANSFER : t.category ?? "" };
    row.amount = round(row.amount + t.amount);
    row.count++;
    row.name = name;
    map.set(key, row);
  }
  return [...map.values()].filter((x) => x.amount >= 1).sort((a, b) => b.amount - a.amount);
}

const normalizeKey = (s: string) => s.toUpperCase();

const SMALL = new Set(["and", "of", "the", "for", "to", "a"]);
/** "CAST AND CREW P PAYROLL PPD ID:" → "Cast and Crew P Payroll". */
function tidyName(s: string): string {
  const words = s.replace(/\b(PPD|CCD|WEB|ID|DES|INDN)\b:?/gi, " ").replace(/[:#*]+/g, " ").trim().split(/\s+/);
  const upper = s === s.toUpperCase();
  return words
    .map((w, i) => (upper ? (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0] + w.slice(1).toLowerCase()) : w))
    .join(" ");
}

/** YYYY-MM plus `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** True for a plausible YYYY. */
export const isYear = (s: unknown): s is string => typeof s === "string" && /^20\d{2}$/.test(s);

/** The months of `year` up to and including `thisMonth`, oldest first. */
export function monthsOf(year: string, thisMonth: string): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const k = `${year}-${String(m).padStart(2, "0")}`;
    if (k <= thisMonth) out.push(k);
  }
  return out;
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
