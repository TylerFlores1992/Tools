import { normalize } from "../normalize.ts";
import type { Txn } from "../types.ts";
import type { Stub } from "./types.ts";

/**
 * A stub's net pay usually arrives in the bank to the cent: direct deposit a day or two after the
 * pay date, or a paper check deposited from the phone up to a few weeks later. So: money in, same
 * amount, between 3 days before the pay date and 30 days after it, not already claimed by another
 * stub. Ties go to a deposit naming the payroll company or employer, then to the nearest date.
 */

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

const words = (s: string | null) => normalize(s ?? "").split(/[^A-Z0-9]+/).filter((w) => w.length >= 4 && !["PAYROLL", "SERVICES", "INC", "LLC", "PRODUCTIONS"].includes(w));

export function findDeposit(stub: Pick<Stub, "net" | "payDate" | "employer" | "payrollCompany">, txns: readonly Txn[], taken: ReadonlySet<string>): Txn | null {
  if (stub.net === null || !stub.payDate || stub.net <= 0) return null;
  const names = [...words(stub.payrollCompany), ...words(stub.employer)];
  const candidates = txns.filter((t) =>
    !t.pending && t.amount > 0 && !taken.has(t.id) &&
    Math.abs(t.amount - stub.net!) < 0.005 &&
    dayDiff(t.posted, stub.payDate!) >= -3 && dayDiff(t.posted, stub.payDate!) <= 30,
  );
  const named = (t: Txn) => names.some((w) => normalize(`${t.description} ${t.payee ?? ""}`).includes(w));
  return candidates.sort((a, b) =>
    Number(named(b)) - Number(named(a)) ||
    Math.abs(dayDiff(a.posted, stub.payDate!)) - Math.abs(dayDiff(b.posted, stub.payDate!)),
  )[0] ?? null;
}

/**
 * Matches every saved stub without a deposit, oldest first, so two identical checks pair with
 * two deposits rather than both with the first. Stubs the owner unlinked by hand (`none`) and
 * manual links are left alone. Returns stub id → transaction id for the new matches.
 */
export function matchDeposits(stubs: readonly Stub[], txns: readonly Txn[]): Map<string, string> {
  const taken = new Set(stubs.map((s) => s.depositTxnId).filter((x): x is string => !!x));
  const out = new Map<string, string>();
  const todo = stubs
    .filter((s) => s.kind === "stub" && s.status === "saved" && !s.depositTxnId && s.depositMatch !== "none")
    .sort((a, b) => (a.payDate ?? "").localeCompare(b.payDate ?? ""));
  for (const s of todo) {
    const t = findDeposit(s, txns, taken);
    if (!t) continue;
    taken.add(t.id);
    out.set(s.id, t.id);
  }
  return out;
}

/**
 * `matchDeposits`, with estimates (estimate.ts) in the picture. Real stubs go first and may take a
 * deposit an estimate was holding: the real stub for that check has arrived, so the estimate is
 * `superseded` (the caller deletes it). An estimate with no deposit yet is superseded too when a
 * real stub has its take-home to the cent within two weeks of its pay date. Then estimates
 * without a deposit are matched to what's left.
 */
export function matchDepositsAndEstimates(stubs: readonly Stub[], txns: readonly Txn[]): { matched: Map<string, string>; superseded: string[] } {
  const real = stubs.filter((s) => !s.estimated);
  const estimates = stubs.filter((s) => s.estimated && s.kind === "stub" && s.status === "saved");
  const realMatched = matchDeposits(real, txns);
  const claimed = new Set([...real.map((s) => s.depositTxnId), ...realMatched.values()].filter((x): x is string => !!x));
  const realNet = real.filter((s) => s.kind === "stub" && s.status === "saved" && s.net !== null && s.payDate);
  const superseded = estimates.filter((e) =>
    (e.depositTxnId && claimed.has(e.depositTxnId)) ||
    (!e.depositTxnId && e.net !== null && e.payDate && realNet.some((r) => Math.abs(r.net! - e.net!) < 0.005 && Math.abs(dayDiff(r.payDate!, e.payDate!)) <= 14)),
  ).map((e) => e.id);
  const gone = new Set(superseded);
  const kept = estimates.filter((e) => !gone.has(e.id));
  const taken = new Set([...claimed, ...kept.map((e) => e.depositTxnId).filter((x): x is string => !!x)]);
  const matched = new Map(realMatched);
  for (const e of kept.filter((e) => !e.depositTxnId && e.depositMatch !== "none").sort((a, b) => (a.payDate ?? "").localeCompare(b.payDate ?? ""))) {
    const t = findDeposit(e, txns, taken);
    if (!t) continue;
    taken.add(t.id);
    matched.set(e.id, t.id);
  }
  return { matched, superseded };
}
