import { countsAsHours } from "./read.ts";
import { TAX_KEYS, type IncomeConfig, type Stub } from "./types.ts";

/**
 * Checks a stub can run on itself. Each failure is a sentence the review screen shows, so a
 * misread digit or a short check is caught before anything is counted. They never block saving:
 * the owner decides.
 */

const close = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;
const sum = (xs: Array<number | null | undefined>) => Math.round(xs.reduce<number>((n, x) => n + (x ?? 0), 0) * 100) / 100;
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type Check = { level: "ok" | "look"; text: string };

export const taxTotal = (s: Pick<Stub, "taxes">) => sum(TAX_KEYS.map((k) => s.taxes[k]));
export const deductionTotal = (s: Pick<Stub, "deductions">) => sum(s.deductions.map((d) => d.amount));

/** Rate set for this employer (by name, case-insensitive contains either way), else the default. */
export function rateFor(config: IncomeConfig, employer: string | null, show: string | null): number | null {
  const names = [employer, show].filter((x): x is string => !!x).map((x) => x.toLowerCase());
  const hit = config.rates.find((r) => names.some((n) => n.includes(r.employer.toLowerCase()) || r.employer.toLowerCase().includes(n)));
  return hit?.rate ?? config.defaultRate;
}

export function stubChecks(s: Stub, previous: Stub | null, config: IncomeConfig): Check[] {
  const out: Check[] = [];
  if (s.kind !== "stub") return out;
  if (s.gross === null || s.net === null) {
    out.push({ level: "look", text: "Gross or net pay is missing." });
    return out;
  }
  // 1. Gross − taxes − deductions = net.
  const expectNet = Math.round((s.gross - taxTotal(s) - deductionTotal(s)) * 100) / 100;
  out.push(close(expectNet, s.net)
    ? { level: "ok", text: "Gross minus taxes and deductions equals net." }
    : { level: "look", text: `Gross minus taxes and deductions is ${usd(expectNet)}, but net reads ${usd(s.net)}. A number was probably misread, or a deduction is missing.` });
  // 2. Earnings lines add up to gross.
  if (s.earnings.length) {
    const e = sum(s.earnings.map((x) => x.amount));
    out.push(close(e, s.gross, 0.05)
      ? { level: "ok", text: "The pay lines add up to gross." }
      : { level: "look", text: `The pay lines add up to ${usd(e)}, but gross reads ${usd(s.gross)}.` });
  }
  // 3. Each line: hours × rate = amount.
  for (const x of s.earnings) {
    if (x.hours && x.rate && !close(x.hours * x.rate, x.amount, Math.max(0.05, x.amount * 0.002))) {
      out.push({ level: "look", text: `${x.label}: ${x.hours} h × ${usd(x.rate)} is ${usd(x.hours * x.rate)}, not ${usd(x.amount)}.` });
    }
  }
  // 4. Overtime paid at the right multiple of the straight-time rate.
  const base = s.earnings.find((x) => x.kind === "regular" && x.rate)?.rate ?? null;
  if (base) {
    for (const x of s.earnings) {
      const want = x.kind === "overtime" ? 1.5 : x.kind === "double_time" ? 2 : null;
      if (want && x.rate && !close(x.rate, base * want, base * 0.01 + 0.01)) {
        out.push({ level: "look", text: `${x.label} is paid at ${usd(x.rate)}, expected ${want}× ${usd(base)} = ${usd(base * want)}.` });
      }
    }
  }
  // 5. Straight-time rate against the rate set for this employer.
  const want = rateFor(config, s.employer, s.showName);
  if (want && base && base + 0.005 < want) {
    out.push({ level: "look", text: `Straight time is ${usd(base)} an hour, below your ${usd(want)} rate for this employer.` });
  }
  // 6. Payroll taxes at their usual rates (6.2% Social Security, 1.45% Medicare, 1.3% CA SDI in 2026).
  const rates: Array<[keyof Stub["taxes"], number, string]> = [["socialSecurity", 0.062, "Social Security"], ["medicare", 0.0145, "Medicare"], ["sdi", 0.013, "CA SDI"]];
  for (const [k, r, name] of rates) {
    const v = s.taxes[k];
    if (v === null || s.gross < 50) continue;
    const pct = v / s.gross;
    // Pre-tax deductions lower the taxable base, so only a rate ABOVE the usual one, or far below, is worth a look.
    if (pct > r * 1.03 || pct < r * 0.7) out.push({ level: "look", text: `${name} is ${(pct * 100).toFixed(2)}% of gross; it's usually ${(r * 100).toFixed(2)}%.` });
  }
  // 7. Year-to-date carries on from the last stub from this employer.
  if (previous && previous.ytd.gross !== null && s.ytd.gross !== null && previous.taxYear === s.taxYear) {
    const expected = Math.round((previous.ytd.gross + s.gross) * 100) / 100;
    out.push(close(expected, s.ytd.gross, 0.05)
      ? { level: "ok", text: "Year-to-date gross carries on from your last stub from this employer." }
      : { level: "look", text: `Year-to-date gross should be ${usd(expected)} (last stub ${usd(previous.ytd.gross)} + this ${usd(s.gross)}), but reads ${usd(s.ytd.gross)}. A stub may be missing in between.` });
  }
  if (!s.payDate) out.push({ level: "look", text: "No pay date was read." });
  if (s.periodEnd && s.payDate && s.periodEnd > s.payDate) out.push({ level: "look", text: "The pay period ends after the pay date." });
  return out;
}

/** Worked hours on a stub (straight, 1.5×, 2×), from its lines, else its hours field. */
export const workedHours = (s: Pick<Stub, "earnings" | "hours">) => {
  const h = s.earnings.reduce((n, e) => n + (countsAsHours(e.kind) && e.hours ? e.hours : 0), 0);
  return h || s.hours || 0;
};

/** California daily pay for `hours` at `rate`: 1× to 8 h, 1.5× from 8 to 12, 2× past 12. */
export function dayPay(hours: number, rate: number): number {
  const st = Math.min(hours, 8);
  const ot = Math.min(Math.max(hours - 8, 0), 4);
  const dt = Math.max(hours - 12, 0);
  return Math.round((st + ot * 1.5 + dt * 2) * rate * 100) / 100;
}

const norm = (s: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

/** The last saved stub from the same employer before this one, in the same tax year. */
export function previousStub(s: Stub, all: readonly Stub[]): Stub | null {
  const who = norm(s.employer) || norm(s.payrollCompany);
  if (!who || !s.payDate) return null;
  return all
    .filter((o) => o.id !== s.id && o.kind === "stub" && o.status === "saved" && o.payDate && o.payDate < s.payDate! && o.taxYear === s.taxYear)
    .filter((o) => (norm(o.employer) || norm(o.payrollCompany)) === who)
    .sort((a, b) => b.payDate!.localeCompare(a.payDate!))[0] ?? null;
}

/** Group key for "by employer" totals and the W-2 check. */
export const employerKey = (s: Pick<Stub, "employer" | "payrollCompany">) => norm(s.employer) || norm(s.payrollCompany) || "UNKNOWN";

/**
 * Whether a W-2 and a stub are from the same employer. The W-2's employer is often the payroll
 * company (the employer of record), while the stub may name the production, so any of either
 * one's names matching any of the other's counts.
 */
export function sameEmployer(a: Pick<Stub, "employer" | "payrollCompany">, b: Pick<Stub, "employer" | "payrollCompany">): boolean {
  const names = (s: Pick<Stub, "employer" | "payrollCompany">) => [s.employer, s.payrollCompany].map(norm).filter((x) => x.length >= 3);
  const bs = names(b);
  return names(a).some((x) => bs.some((y) => x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `)));
}
