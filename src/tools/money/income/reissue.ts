import { taxTotal } from "./checks.ts";
import type { Stub } from "./types.ts";

/**
 * Reissued stubs. Payroll sometimes re-runs a week (a union rate applied late, a correction): the
 * new stub recomputes the whole week's gross and taxes and takes back what the first check paid,
 * as a deduction usually printed "NET PRIOR". Its own net is just the difference.
 *
 * Counting both stubs would double that week's gross, taxes and hours. So the first stub is
 * "replaced": it still counts as money received (its check did arrive, and it matches its own
 * deposit), but gross, taxes, hours, the withholding estimate, the W-2 check and health-plan hours
 * come from the reissue.
 *
 * A saved stub is replaced by a later saved stub for the same pay period when the later one takes
 * back exactly its take-home: a deduction mentioning "prior" of that amount, or (deductions not
 * itemized) gross − taxes − net − other deductions equal to it, to the cent.
 */

const PRIOR = /\bPRIOR\b/i;
const near = (a: number, b: number) => Math.abs(a - b) < 0.02;

/** Original stub id → the id of the stub that reissued it. */
export function replacedBy(stubs: readonly Stub[]): Map<string, string> {
  const saved = stubs.filter((s) => s.kind === "stub" && s.status === "saved" && s.periodStart && s.periodEnd && s.net !== null && s.payDate);
  const out = new Map<string, string>();
  for (const r of saved) {
    const other = r.deductions.filter((d) => !PRIOR.test(d.label)).reduce((n, d) => n + d.amount, 0);
    const takenBack = [
      ...r.deductions.filter((d) => PRIOR.test(d.label)).map((d) => d.amount),
      ...(r.gross !== null ? [r.gross - taxTotal(r) - r.net! - other] : []),
    ].filter((x) => x > 0.005);
    if (!takenBack.length) continue;
    const original = saved
      .filter((o) => o.id !== r.id && !out.has(o.id) && o.periodStart === r.periodStart && o.periodEnd === r.periodEnd)
      .filter((o) => o.payDate! < r.payDate! || (o.payDate === r.payDate && o.createdAt < r.createdAt))
      .find((o) => takenBack.some((x) => near(x, o.net!)));
    if (original) out.set(original.id, r.id);
  }
  return out;
}

/** Saved pay stubs that count toward gross, taxes and hours (reissued originals left out). */
export function countedStubs(stubs: readonly Stub[]): Stub[] {
  const gone = replacedBy(stubs);
  return stubs.filter((s) => s.kind === "stub" && s.status === "saved" && !gone.has(s.id));
}
