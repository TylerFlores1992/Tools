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

/** A pay period longer than this is a misread (payrolls here run one or two weeks). */
export const MAX_PERIOD_DAYS = 31;

/** Words that say nothing about which job it was. */
const FILLER = new Set(["the", "and", "of", "llc", "inc", "co", "corp", "ltd", "season", "s", "production", "productions", "service", "services", "studio", "studios"]);

/** A name's meaningful words, lower case, apostrophes dropped ("HAPPY'S PLACE" -> happys, place). */
export function nameWords(s: string | null | undefined): string[] {
  return (s ?? "").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter((w) => w && !FILLER.has(w));
}

/**
 * A calendar event belongs to this stub's job when every meaningful word of its title appears in
 * the stub's show, employer or payroll name: "Happys Place" goes with "HAPPY'S PLACE SEASON 3",
 * "Universal" with "Universal City Studios LLC", and "TAC" with neither.
 */
export function titleMatches(title: string, stub: Partial<Pick<Stub, "showName" | "employer" | "payrollCompany">>): boolean {
  const words = nameWords(title);
  if (!words.length) return false;
  const pool = new Set([stub.showName, stub.employer, stub.payrollCompany].flatMap(nameWords));
  return words.every((w) => pool.has(w));
}

/**
 * Calendar days a new stub pays for, ticked for the owner to check: the days inside its pay period
 * that no other saved stub has claimed. When some of those days are named for this stub's show,
 * employer or payroll (see `titleMatches`), only those are ticked, so another job worked the same
 * week isn't. A period longer than a month is a misread, so only its last week is used.
 */
export function defaultLinks(
  stub: Pick<Stub, "id" | "periodStart" | "periodEnd" | "payDate"> & Partial<Pick<Stub, "showName" | "employer" | "payrollCompany">>,
  events: readonly WorkEvent[],
  others: readonly Stub[],
): string[] {
  const to = stub.periodEnd ?? stub.payDate;
  let from = stub.periodStart ?? (stub.periodEnd ? addDays(stub.periodEnd, -6) : null);
  if (!from || !to) return [];
  const span = dayDiff(to, from);
  if (span < 0 || span > MAX_PERIOD_DAYS) from = addDays(to, -6);
  const taken = new Set(others.filter((o) => o.id !== stub.id && o.status === "saved").flatMap((o) => o.workDays));
  const open = (e: WorkEvent) => eventDays(e).filter((d) => d >= from && d <= to).map((d) => dayKey(e.eventId, d)).filter((k) => !taken.has(k));
  const named = events.filter((e) => titleMatches(e.title, stub)).flatMap(open);
  return named.length ? named : events.flatMap(open);
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
