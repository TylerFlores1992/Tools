import { INCOME_CATEGORIES, TRANSFER, dayDiff } from "./categorize.ts";
import { displayName, merchantKey } from "./merchant.ts";

export { merchantKey };
import type { Txn } from "./types.ts";

/**
 * Finding recurring payments (subscriptions, bills, paychecks) from transaction history.
 * Transactions are grouped by a merchant key (the description with dates, card digits and store
 * numbers removed), then each group's spacing is checked against a known cadence.
 */

export type Cadence = "weekly" | "every 2 weeks" | "twice a month" | "monthly" | "every 2 months" | "quarterly" | "yearly";

export type Recurring = {
  key: string;
  /** A readable name: the most recent description for the group. */
  name: string;
  direction: "out" | "in";
  cadence: Cadence;
  /** Median absolute amount. */
  typical: number;
  /** True when amounts swing more than 15% around the median (e.g. a utility bill). */
  varies: boolean;
  count: number;
  last: string;
  /** YYYY-MM-DD the next one is expected. */
  next: string;
  /** "stopped" when it's overdue by more than half a cycle. */
  status: "active" | "stopped";
  category: string | null;
  accountIds: string[];
  /** The transactions in the series (the budget uses them to tell bills from everyday spending). */
  txnIds: string[];
};

const CADENCES: ReadonlyArray<{ cadence: Cadence; min: number; max: number; minCount: number }> = [
  { cadence: "weekly", min: 6, max: 8, minCount: 4 },
  { cadence: "every 2 weeks", min: 13, max: 15, minCount: 3 },
  { cadence: "twice a month", min: 14, max: 17, minCount: 4 },
  { cadence: "monthly", min: 26, max: 34, minCount: 3 },
  { cadence: "every 2 months", min: 55, max: 67, minCount: 2 },
  { cadence: "quarterly", min: 85, max: 97, minCount: 2 },
  { cadence: "yearly", min: 350, max: 380, minCount: 2 },
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Recurring series in `txns` as of `today` (YYYY-MM-DD). Transfers and pending transactions are
 * ignored. A series needs the cadence's minimum count and at least two thirds of its gaps inside
 * the cadence's range.
 */
/** The category a relabeled cross-owner transfer carries inside the recurring list. */
export const TRANSFER_BILL = "Moved to another owner";

// Everyday spending isn't a bill even when it's regular (groceries every week, DoorDash on Fridays).
// A waived monthly bank fee isn't a bill either.
const NOT_BILLS: ReadonlySet<string> = new Set(["Dining", "Groceries", "Gas", "Shopping", "Fees", TRANSFER]);
// Bills whose amount follows usage (power, water, cloud services): the schedule is the evidence,
// so their amounts may swing and two monthly charges are enough.
const METERED: ReadonlySet<string> = new Set([TRANSFER_BILL, "Utilities", "Software", "Phone & internet", "Subscriptions", "Insurance", "Housing", "Loans"]);

/** Groups amounts within 20% of each other (Spectrum internet vs Spectrum mobile on one name). */
function byAmount(list: readonly Txn[]): Txn[][] {
  const clusters: Txn[][] = [];
  for (const t of [...list].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))) {
    const c = clusters[clusters.length - 1];
    const ref = c ? Math.abs(c[0].amount) : 0;
    if (c && Math.abs(t.amount) <= ref * 1.2 + 0.01) c.push(t);
    else clusters.push([t]);
  }
  return clusters;
}

/**
 * `across` (from transfersAcross) relabels transfers that leave the view for another owner's
 * account, e.g. "Transfer to Joint": in the Mine view the monthly transfer to joint is a bill
 * (owner, 2026-10-18). Other transfers are never recurring bills or income.
 */
export function findRecurring(txns: readonly Txn[], today: string, across?: ReadonlyMap<string, string>): Recurring[] {
  const groups = new Map<string, Txn[]>();
  for (const raw of txns) {
    const label = raw.category === TRANSFER ? across?.get(raw.id) : undefined;
    const t = label ? { ...raw, category: TRANSFER_BILL, payee: label, description: label } : raw;
    if (t.pending || NOT_BILLS.has(t.category ?? "")) continue;
    // Money in is recurring income only when it's income (a refund is not a paycheck).
    if (t.amount > 0 && !label && t.category && !INCOME_CATEGORIES.has(t.category)) continue;
    // Keyed on the bank's description, not the payee: the synced feed adds a clean payee
    // ("Valon") that a CSV import of the same bill never has ("WEB AUTHORIZED PMT Valon"), so a
    // payee key splits one bill into a "stopped" CSV series and a short synced one.
    const key = merchantKey(t.description) || merchantKey(t.payee ?? "");
    if (!key) continue;
    const dir = t.amount < 0 ? "out" : "in";
    const id = `${dir}:${key}`;
    (groups.get(id) ?? groups.set(id, []).get(id)!).push(t);
  }

  const found: Recurring[] = [];
  for (const [id, list] of groups) {
    const whole = fitSeries(id, list, today);
    if (whole) { found.push(whole); continue; }
    // One name, two bills (Spectrum internet and mobile): try each amount band on its own. Bills
    // only: on a shop, bands of similar amounts would invent subscriptions.
    if (!METERED.has(list[list.length - 1].category ?? "")) continue;
    const bands = byAmount(list);
    if (bands.length > 1) bands.forEach((b, i) => { const r = fitSeries(`${id}#${i}`, b, today); if (r) found.push(r); });
  }

  return found.sort((a, b) => (a.status === b.status ? a.next.localeCompare(b.next) : a.status === "active" ? -1 : 1));
}

function fitSeries(id: string, list: readonly Txn[], today: string): Recurring | null {
  // One charge per day per merchant (a split charge shouldn't look like a weekly series).
  const byDay = new Map<string, Txn>();
  for (const t of list) if (!byDay.has(t.posted)) byDay.set(t.posted, t);
  const series = [...byDay.values()].sort((a, b) => a.posted.localeCompare(b.posted));
  if (series.length < 2) return null;

  const gaps = series.slice(1).map((t, i) => dayDiff(t.posted, series[i].posted));
  const gap = median(gaps);
  const amounts = series.map((t) => Math.abs(t.amount));
  const typical = median(amounts);
  // Only 90 days of bank history: a monthly bill is often seen just twice. Two charges a month
  // apart for (nearly) the same amount count, which a shop visited twice almost never matches.
  const metered = METERED.has(series[series.length - 1].category ?? "");
  const twiceSame = series.length === 2 && (metered || Math.abs(amounts[0] - amounts[1]) <= Math.max(0.5, typical * 0.03));
  const fit = CADENCES.find((c) =>
    gap >= c.min && gap <= c.max &&
    (series.length >= c.minCount || (c.cadence === "monthly" && twiceSame)) &&
    gaps.filter((g) => g >= c.min - 2 && g <= c.max + 2).length >= Math.ceil((gaps.length * 2) / 3),
  );
  if (!fit) return null;

  // Amounts must look like the same bill: within 50% of the median, or it's just a store you visit.
  if (!metered && amounts.some((a) => Math.abs(a - typical) > typical * 0.5)) return null;
  // Interest of a cent a month is regular, and not worth a line.
  if (typical < 1) return null;
  const varies = amounts.some((a) => Math.abs(a - typical) > typical * 0.15);

  const lastTxn = series[series.length - 1];
  const step = Math.round(gap);
  const next = addDays(lastTxn.posted, step);
  const overdue = dayDiff(today, next);
  return {
    key: id,
    name: lastTxn.payee?.trim() || displayName(lastTxn.description),
    direction: id.startsWith("out:") ? "out" : "in",
    cadence: fit.cadence,
    typical: Math.round(typical * 100) / 100,
    varies,
    count: series.length,
    last: lastTxn.posted,
    next,
    status: overdue > step / 2 ? "stopped" : "active",
    category: lastTxn.category,
    accountIds: [...new Set(series.map((t) => t.accountId))],
    txnIds: list.map((t) => t.id),
  };
}

/** Rough cost per month, for totals ("about $210 a month in subscriptions"). */
export function monthlyEquivalent(r: Pick<Recurring, "cadence" | "typical">): number {
  const perMonth: Record<Cadence, number> = {
    weekly: 52 / 12, "every 2 weeks": 26 / 12, "twice a month": 2, monthly: 1, "every 2 months": 1 / 2, quarterly: 1 / 3, yearly: 1 / 12,
  };
  return r.typical * perMonth[r.cadence];
}
