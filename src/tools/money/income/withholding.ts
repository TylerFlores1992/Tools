import { workedHours } from "./checks.ts";
import type { IncomeConfig, Stub, W2 } from "./types.ts";

/**
 * A rough federal check: is enough being withheld across all employers?
 * Each employer withholds as if it were your only job, so several at once can leave you short.
 * 2026 figures from IRS Rev. Proc. 2025-32 (standard deduction $16,100 single / $32,200 joint)
 * and the 2026 Social Security wage base ($184,500). California is not estimated here: its 2026
 * schedule wasn't published when this was written, and a wrong state number is worse than none.
 * Not tax advice: no credits, no other deductions, no self-employment or investment income.
 */

export const TAX_YEAR = 2026;
const STANDARD = { single: 16100, joint: 32200 };
const BRACKETS: Record<"single" | "joint", Array<[number, number]>> = {
  single: [[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
  joint: [[24800, 0.1], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]],
};
export const SS_WAGE_BASE_2026 = 184500;
/** "No tax on overtime" (2025–2028): the premium half of FLSA-required overtime, capped. */
const OT_CAP = { single: 12500, joint: 25000 };

export function federalTax(taxable: number, filing: "single" | "joint"): number {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of BRACKETS[filing]) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return Math.round(tax * 100) / 100;
}

export type Estimate = {
  wagesSoFar: number;
  withheldSoFar: number;
  weeksSoFar: number;
  scenarios: Array<{ label: string; wages: number; tax: number; withheld: number; gap: number }>; // gap > 0 = owe
  overtimePremium: number;
  ssOverWithheld: number; // Social Security withheld above the wage base across employers (comes back at filing)
};

const round = (n: number) => Math.round(n * 100) / 100;

export function withholdingEstimate(stubs: readonly Stub[], config: IncomeConfig, today: string): Estimate {
  const year = Number(today.slice(0, 4));
  const mine = stubs.filter((s) => s.kind === "stub" && s.status === "saved" && (s.taxYear ?? Number((s.payDate ?? "").slice(0, 4))) === year);
  const wagesSoFar = round(mine.reduce((n, s) => n + (s.gross ?? 0), 0));
  const withheldSoFar = round(mine.reduce((n, s) => n + (s.taxes.federal ?? 0), 0));
  const ss = round(mine.reduce((n, s) => n + (s.taxes.socialSecurity ?? 0), 0));
  const overtimePremium = round(mine.reduce((n, s) => n + s.earnings.reduce((m, e) => m + (e.kind === "overtime" ? e.amount / 3 : e.kind === "double_time" ? e.amount / 2 : 0), 0), 0));
  // Weeks elapsed this year (at least one), for the "at this pace" line.
  const start = Date.parse(`${year}-01-01T00:00:00Z`);
  const weeksSoFar = Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - start) / (7 * 86_400_000)));
  const paceWages = round((wagesSoFar / weeksSoFar) * 52);
  const paceWithheld = round((withheldSoFar / weeksSoFar) * 52);
  const { filing, otherWages, otherFederalWithheld, overtimeDeduction } = config.tax;
  const scenario = (label: string, wages: number, withheld: number) => {
    const otDeduction = overtimeDeduction ? Math.min(OT_CAP[filing], overtimePremium * (wages / Math.max(1, wagesSoFar))) : 0;
    const taxable = Math.max(0, wages + otherWages - STANDARD[filing] - otDeduction);
    const tax = federalTax(taxable, filing);
    const w = round(withheld + otherFederalWithheld);
    return { label, wages: round(wages + otherWages), tax, withheld: w, gap: round(tax - w) };
  };
  return {
    wagesSoFar, withheldSoFar, weeksSoFar,
    scenarios: [
      scenario("If you earn nothing more this year", wagesSoFar, withheldSoFar),
      scenario("If the rest of the year goes like it has so far", paceWages, paceWithheld),
    ],
    overtimePremium,
    ssOverWithheld: round(Math.max(0, ss - SS_WAGE_BASE_2026 * 0.062)),
  };
}

export type W2Line = { label: string; w2: number | null; stubs: number | null; differs: boolean };

/**
 * A W-2 against the year's saved stubs from the same employer. Withholding boxes should match the
 * stubs to the cent; box 1 can be lower than gross because pre-tax deductions come off it.
 */
export function w2Check(w2: W2, stubs: readonly Stub[]): { lines: W2Line[]; stubCount: number } {
  const s = stubs.filter((x) => x.kind === "stub" && x.status === "saved");
  const total = (f: (x: Stub) => number | null) => (s.length ? round(s.reduce((n, x) => n + (f(x) ?? 0), 0)) : null);
  const line = (label: string, w: number | null, t: number | null, tol = 0.02): W2Line => ({ label, w2: w, stubs: t, differs: w !== null && t !== null && Math.abs(w - t) > tol });
  return {
    stubCount: s.length,
    lines: [
      // Box 1 below gross is normal (pre-tax deductions); above it means a stub is missing.
      { ...line("Gross pay vs box 1 (box 1 can be lower: pre-tax deductions)", w2.box1Wages, total((x) => x.gross)), differs: w2.box1Wages !== null && s.length > 0 && w2.box1Wages > total((x) => x.gross)! + 0.02 },
      line("Federal income tax (box 2)", w2.box2Federal, total((x) => x.taxes.federal)),
      line("Social Security (box 4)", w2.box4Ss, total((x) => x.taxes.socialSecurity)),
      line("Medicare (box 6)", w2.box6Medicare, total((x) => x.taxes.medicare)),
      line("CA income tax (box 17)", w2.box17State, total((x) => x.taxes.state)),
      line("CA SDI (box 14)", w2.sdi, total((x) => x.taxes.sdi)),
    ],
  };
}

export { workedHours };
