import { countedStubs } from "./reissue.ts";
import { workedHours } from "./checks.ts";
import type { IncomeConfig, Stub } from "./types.ts";

/**
 * Hours toward union health coverage, counted from saved stubs by pay-period end (else pay date).
 * Plans count "hours worked reported by employers" in fixed periods (the Motion Picture plan:
 * 400 hours per six months to keep coverage, banking up to 450). The plan's own count is the
 * authority: employers report late, and some plans credit guaranteed or travel hours a stub
 * doesn't show. This is a running guide, set up in Income settings.
 */

export type HealthPeriod = { label: string; from: string; to: string; hours: number; needed: number; current: boolean };

const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

export function healthPeriods(stubs: readonly Stub[], config: IncomeConfig, today: string, count = 4): HealthPeriod[] {
  const { periodMonths, firstMonth, hoursPerPeriod } = config.health;
  const len = Math.max(1, Math.min(12, Math.round(periodMonths)));
  // Period start months for any year: firstMonth, firstMonth + len, ...
  const y = Number(today.slice(0, 4));
  const starts: string[] = [];
  for (let yr = y - 2; yr <= y; yr++) {
    for (let m = ((firstMonth - 1) % len) + 1; m <= 12; m += len) starts.push(ymd(yr, m, 1));
  }
  starts.sort();
  const periods = starts.map((from) => {
    const [fy, fm] = from.split("-").map(Number);
    const to = ymd(fy, fm + len, 0); // last day of the period
    const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    return { from, to, label: `${fmt(from)} – ${fmt(to)}` };
  }).filter((p) => p.from <= today);
  return periods.slice(-count).map((p) => {
    const hours = countedStubs(stubs)
      .filter((s) => { const d = s.periodEnd ?? s.payDate; return !!d && d >= p.from && d <= p.to; })
      .reduce((n, s) => n + workedHours(s), 0);
    return { ...p, hours: Math.round(hours * 10) / 10, needed: hoursPerPeriod, current: today >= p.from && today <= p.to };
  });
}
