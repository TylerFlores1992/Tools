import { TRANSFER, dayDiff, normalize } from "./categorize.ts";
import type { Txn } from "./types.ts";

/**
 * Finding recurring payments (subscriptions, bills, paychecks) from transaction history.
 * Transactions are grouped by a merchant key (the description with dates, card digits and store
 * numbers removed), then each group's spacing is checked against a known cadence.
 */

export type Cadence = "weekly" | "every 2 weeks" | "twice a month" | "monthly" | "quarterly" | "yearly";

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
};

const CADENCES: ReadonlyArray<{ cadence: Cadence; min: number; max: number; minCount: number }> = [
  { cadence: "weekly", min: 6, max: 8, minCount: 4 },
  { cadence: "every 2 weeks", min: 13, max: 15, minCount: 3 },
  { cadence: "twice a month", min: 14, max: 17, minCount: 4 },
  { cadence: "monthly", min: 26, max: 34, minCount: 3 },
  { cadence: "quarterly", min: 85, max: 97, minCount: 2 },
  { cadence: "yearly", min: 350, max: 380, minCount: 2 },
];

// Words that vary between charges from the same merchant, or carry no identity.
const NOISE = /\b(POS|PURCHASE|DEBIT|CREDIT|CARD|CHECKCARD|RECURRING|PAYMENT|PMT|ACH|WEB|ID|PPD|CCD|WEB ID|ONLINE|AUTH|ON|REF|TRACE|XX+\d*|DES|INDN|CO ID)\b/g;

/** The grouping key: letters only, noise removed, first four words. */
export function merchantKey(description: string): string {
  return normalize(description)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^A-Z&' ]+/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 4)
    .join(" ");
}

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
export function findRecurring(txns: readonly Txn[], today: string): Recurring[] {
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.pending || t.category === TRANSFER) continue;
    const key = merchantKey(t.payee || t.description);
    if (!key) continue;
    const dir = t.amount < 0 ? "out" : "in";
    const id = `${dir}:${key}`;
    (groups.get(id) ?? groups.set(id, []).get(id)!).push(t);
  }

  const found: Recurring[] = [];
  for (const [id, list] of groups) {
    // One charge per day per merchant (a split charge shouldn't look like a weekly series).
    const byDay = new Map<string, Txn>();
    for (const t of list) if (!byDay.has(t.posted)) byDay.set(t.posted, t);
    const series = [...byDay.values()].sort((a, b) => a.posted.localeCompare(b.posted));
    if (series.length < 2) continue;

    const gaps = series.slice(1).map((t, i) => dayDiff(t.posted, series[i].posted));
    const gap = median(gaps);
    const fit = CADENCES.find((c) =>
      gap >= c.min && gap <= c.max &&
      series.length >= c.minCount &&
      gaps.filter((g) => g >= c.min - 2 && g <= c.max + 2).length >= Math.ceil((gaps.length * 2) / 3),
    );
    if (!fit) continue;

    const amounts = series.map((t) => Math.abs(t.amount));
    const typical = median(amounts);
    // Amounts must look like the same bill: within 50% of the median, or it's just a store you visit.
    if (amounts.some((a) => Math.abs(a - typical) > typical * 0.5)) continue;
    const varies = amounts.some((a) => Math.abs(a - typical) > typical * 0.15);

    const lastTxn = series[series.length - 1];
    const step = Math.round(gap);
    const next = addDays(lastTxn.posted, step);
    const overdue = dayDiff(today, next);
    found.push({
      key: id,
      name: (lastTxn.payee || lastTxn.description).trim(),
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
    });
  }

  return found.sort((a, b) => (a.status === b.status ? a.next.localeCompare(b.next) : a.status === "active" ? -1 : 1));
}

/** Rough cost per month, for totals ("about $210 a month in subscriptions"). */
export function monthlyEquivalent(r: Pick<Recurring, "cadence" | "typical">): number {
  const perMonth: Record<Cadence, number> = {
    weekly: 52 / 12, "every 2 weeks": 26 / 12, "twice a month": 2, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12,
  };
  return r.typical * perMonth[r.cadence];
}
