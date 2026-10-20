import { normalize } from "../normalize.ts";
import type { Txn } from "../types.ts";
import type { Stub } from "./types.ts";

/**
 * California EDD benefits: Paid Family Leave (PFL) and Disability Insurance (DI). They arrive as
 * bank deposits ("California EDD DI Deposit" for both), with no pay stub, so each deposit is filed
 * by the owner as one or the other and kept as a `benefit` row next to the stubs.
 *
 * Tax, per EDD (edd.ca.gov, "Form 1099G FAQs" for SDI, read 2026-10-20): PFL is taxable on the
 * federal return only, and nothing is withheld; DI is usually not taxable at all (it is when it
 * stands in for unemployment benefits, which this doesn't try to judge). Neither is taxed by
 * California. So PFL counts toward the federal withholding estimate; DI doesn't. Neither is wages:
 * not gross pay, not on a W-2, no Social Security or Medicare.
 */

export const PFL = "Paid Family Leave";
export const DI = "Disability Insurance";
export type Program = typeof PFL | typeof DI;
export const PROGRAMS: readonly Program[] = [PFL, DI];

const EDD = /\bEDD\b/;

/** An EDD deposit (money in, posted). */
export const isEddDeposit = (t: Pick<Txn, "amount" | "description" | "payee" | "pending">) =>
  t.amount > 0 && !t.pending && EDD.test(normalize(`${t.description} ${t.payee ?? ""}`));

export const isBenefit = (s: Stub) => s.kind === "benefit" && s.status === "saved";

/** Federally taxable: Paid Family Leave. */
export const federallyTaxable = (s: Stub) => isBenefit(s) && s.showName === PFL;

export const yearOfBenefit = (s: Stub) => s.taxYear ?? (s.payDate ? Number(s.payDate.slice(0, 4)) : null);

/** EDD deposits not filed yet, oldest first. */
export function unfiledEdd(txns: readonly Txn[], stubs: readonly Stub[]): Txn[] {
  const filed = new Set(stubs.filter((s) => s.kind === "benefit").map((s) => s.depositTxnId).filter(Boolean));
  return txns.filter((t) => isEddDeposit(t) && !filed.has(t.id)).sort((a, b) => a.posted.localeCompare(b.posted));
}

export type BenefitYear = { program: Program; total: number; count: number; federallyTaxable: boolean };

export function benefitsByProgram(stubs: readonly Stub[], year: number): BenefitYear[] {
  return PROGRAMS.map((program) => {
    const mine = stubs.filter((s) => isBenefit(s) && s.showName === program && yearOfBenefit(s) === year);
    return { program, total: Math.round(mine.reduce((n, s) => n + (s.gross ?? 0), 0) * 100) / 100, count: mine.length, federallyTaxable: program === PFL };
  }).filter((b) => b.count > 0);
}

/** Paid Family Leave received in `year`: federal taxable income with nothing withheld. */
export const taxableBenefits = (stubs: readonly Stub[], year: number) =>
  Math.round(stubs.filter((s) => federallyTaxable(s) && yearOfBenefit(s) === year).reduce((n, s) => n + (s.gross ?? 0), 0) * 100) / 100;
