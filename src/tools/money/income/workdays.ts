import { dayPay, rateFor } from "./checks.ts";
import type { IncomeConfig, Stub, WorkEvent } from "./types.ts";

/**
 * Work days from the calendar, and where each one's pay stands:
 *   scheduled  the day hasn't happened yet
 *   waiting    worked, no stub yet (late once it's older than the pay lag)
 *   stub       a saved stub covers it, but its money isn't in the bank yet
 *   paid       a saved stub covers it and its deposit has been found
 *   marked     no stub, but the calendar already says paid (weeks from before this existed)
 * A day belongs to a stub through the stub's `workDays` links, which default to the calendar
 * days inside its pay period (see `defaultLinks`). Statuses are words; colour is never the signal.
 */

export type DayStatus = "scheduled" | "waiting" | "stub" | "paid" | "marked";
export type WorkDay = {
  key: string; // "<event id>|YYYY-MM-DD"
  eventId: string;
  day: string;
  title: string;
  status: DayStatus;
  late: boolean;
  ageDays: number;
  stubId: string | null;
  expected: number | null; // estimated gross for a day still waiting
};

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

export function eventDays(e: Pick<WorkEvent, "startDay" | "endDay">): string[] {
  const out: string[] = [];
  for (let d = e.startDay; d <= e.endDay && out.length < 62; d = addDays(d, 1)) out.push(d);
  return out;
}

export const dayKey = (eventId: string, day: string) => `${eventId}|${day}`;

/** Calendar days inside a stub's pay period that no other stub has claimed. */
export function defaultLinks(stub: Pick<Stub, "id" | "periodStart" | "periodEnd" | "payDate">, events: readonly WorkEvent[], others: readonly Stub[]): string[] {
  const from = stub.periodStart ?? (stub.periodEnd ? addDays(stub.periodEnd, -6) : null);
  const to = stub.periodEnd ?? stub.payDate;
  if (!from || !to) return [];
  const taken = new Set(others.filter((o) => o.id !== stub.id && o.status === "saved").flatMap((o) => o.workDays));
  return events.flatMap((e) => eventDays(e).filter((d) => d >= from && d <= to).map((d) => dayKey(e.eventId, d))).filter((k) => !taken.has(k));
}

export function workDays(events: readonly WorkEvent[], stubs: readonly Stub[], config: IncomeConfig, today: string): WorkDay[] {
  const byKey = new Map<string, Stub>();
  for (const s of stubs) if (s.status === "saved" && s.kind === "stub") for (const k of s.workDays) byKey.set(k, s);
  const out: WorkDay[] = [];
  for (const e of events) {
    for (const day of eventDays(e)) {
      const key = dayKey(e.eventId, day);
      const stub = byKey.get(key) ?? null;
      const age = dayDiff(today, day);
      let status: DayStatus;
      if (stub) status = stub.depositTxnId ? "paid" : "stub";
      else if (day > today) status = "scheduled";
      else if (e.color === config.paidColor) status = "marked";
      else status = "waiting";
      const rate = status === "waiting" || status === "scheduled" ? rateFor(config, null, e.title) : null;
      out.push({
        key, eventId: e.eventId, day, title: e.title, status,
        late: status === "waiting" && age > config.payLagDays,
        ageDays: age,
        stubId: stub?.id ?? null,
        expected: rate ? dayPay(config.defaultHoursPerDay, rate) : null,
      });
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Events to turn the paid colour: every day of the event is paid (its stub's deposit was found),
 * and it isn't that colour already. Only when the owner left recolouring on.
 */
export function recolorIds(events: readonly WorkEvent[], days: readonly WorkDay[], config: IncomeConfig): string[] {
  if (!config.recolor) return [];
  const byEvent = new Map<string, WorkDay[]>();
  for (const d of days) (byEvent.get(d.eventId) ?? byEvent.set(d.eventId, []).get(d.eventId)!).push(d);
  return events
    .filter((e) => e.color !== config.paidColor && (byEvent.get(e.eventId) ?? []).length > 0 && byEvent.get(e.eventId)!.every((d) => d.status === "paid"))
    .map((e) => e.eventId);
}
