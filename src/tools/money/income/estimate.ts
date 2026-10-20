import { workedHours } from "./checks.ts";
import { countedStubs, replacedBy } from "./reissue.ts";
import { TAX_KEYS, emptyTaxes, type Stub, type Taxes } from "./types.ts";

/**
 * Estimated stubs, for pay that reached the bank without a stub to show for it. Two ways:
 *
 *  - From a later stub's year-to-date (exact for the year). A stub's YTD column covers every
 *    check that employer paid this year, so YTD minus the stubs we have is exactly what the
 *    missing checks add up to. Split across those checks in proportion to each one's take-home:
 *    the year is exact, each check's share is the estimate.
 *  - From similar stubs (an estimate throughout). Gross and each tax scaled from the saved stubs
 *    whose take-home is closest to the deposit's.
 *
 * Either way gross − taxes = take-home, to the cent. Estimates are marked `estimated`, and a real
 * stub for the same check replaces one (match.ts, `matchDepositsAndEstimates`).
 */

export type Totals = { gross: number; net: number; hours: number; taxes: Taxes };

const cents = (n: number) => Math.round(n * 100) / 100;

/** YTD on `latest` minus that stub and the other saved stubs from the same employer that year. */
export function remainingFromYtd(latest: Stub, all: readonly Stub[]): Totals | null {
  const y = latest.ytd;
  if (y.gross === null || y.net === null) return null;
  const who = (s: Stub) => (s.employer ?? "").trim().toUpperCase();
  const have = countedStubs(all).filter((s) => !s.estimated && who(s) === who(latest) && s.taxYear === latest.taxYear && (s.payDate ?? "") <= (latest.payDate ?? ""));
  if (!have.some((s) => s.id === latest.id)) have.push(latest);
  const sum = (f: (s: Stub) => number | null) => have.reduce((n, s) => n + (f(s) ?? 0), 0);
  const taxes = emptyTaxes();
  const ytdTax: Partial<Record<keyof Taxes, number | null>> = { federal: y.federal, socialSecurity: y.socialSecurity, medicare: y.medicare, state: y.state, sdi: y.sdi };
  for (const k of TAX_KEYS) {
    const v = ytdTax[k];
    taxes[k] = v === undefined || v === null ? 0 : cents(v - sum((s) => s.taxes[k]));
  }
  return {
    gross: cents(y.gross - sum((s) => s.gross)),
    net: cents(y.net - sum((s) => s.net)),
    hours: y.hours === null ? 0 : Math.round((y.hours - sum((s) => workedHours(s) || s.hours)) * 10) / 10,
    taxes,
  };
}

/** Split `total` across checks in proportion to their take-home; the last one takes the rounding. */
export function splitByNet(total: Totals, nets: readonly number[]): Totals[] {
  const all = nets.reduce((n, x) => n + x, 0);
  const out: Totals[] = [];
  const used: Totals = { gross: 0, net: 0, hours: 0, taxes: emptyTaxes() };
  nets.forEach((net, i) => {
    const last = i === nets.length - 1;
    const share = all ? net / all : 0;
    const taxes = emptyTaxes();
    for (const k of TAX_KEYS) taxes[k] = last ? cents((total.taxes[k] ?? 0) - (used.taxes[k] ?? 0)) : cents((total.taxes[k] ?? 0) * share);
    const raw: Totals = {
      net,
      gross: last ? cents(total.gross - used.gross) : cents(total.gross * share),
      hours: last ? Math.round((total.hours - used.hours) * 10) / 10 : Math.round(total.hours * share * 10) / 10,
      taxes,
    };
    // Earlier checks are balanced now so the last one, which takes what's left, balances too.
    const t = last ? raw : balance(raw);
    out.push(t);
    used.gross += t.gross; used.hours += t.hours;
    for (const k of TAX_KEYS) used.taxes[k] = (used.taxes[k] ?? 0) + (t.taxes[k] ?? 0);
  });
  return out;
}

/** From the `k` saved stubs whose take-home is closest to `net` (reissues and estimates left out). */
export function estimateFromSimilar(net: number, all: readonly Stub[], k = 5): Totals | null {
  if (!(net > 0)) return null;
  const reissues = new Set(replacedBy(all).values());
  const pool = countedStubs(all)
    .filter((s) => !s.estimated && !reissues.has(s.id) && (s.gross ?? 0) > 0 && (s.net ?? 0) > 0)
    .sort((a, b) => Math.abs(Math.log(a.net! / net)) - Math.abs(Math.log(b.net! / net)) || (b.payDate ?? "").localeCompare(a.payDate ?? ""))
    .slice(0, k);
  if (!pool.length) return null;
  const mean = (f: (s: Stub) => number) => pool.reduce((n, s) => n + f(s), 0) / pool.length;
  const taxes = emptyTaxes();
  for (const key of TAX_KEYS) taxes[key] = cents(net * mean((s) => (s.taxes[key] ?? 0) / s.net!));
  return balance({
    net,
    gross: cents(net * mean((s) => s.gross! / s.net!)),
    hours: Math.round(net * mean((s) => (workedHours(s) || s.hours || 0) / s.net!) * 10) / 10,
    taxes,
  });
}

/** Make gross − taxes = take-home exactly: rounding goes to federal (or gross when there's no tax). */
function balance(t: Totals): Totals {
  const taxSum = TAX_KEYS.reduce((n, k) => n + (t.taxes[k] ?? 0), 0);
  const off = cents(t.gross - taxSum - t.net);
  if (Math.abs(off) < 0.005) return t;
  if (taxSum > 0) return { ...t, taxes: { ...t.taxes, federal: cents((t.taxes.federal ?? 0) + off) } };
  return { ...t, gross: cents(t.gross - off) };
}
