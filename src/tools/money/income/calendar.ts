import type { DayStatus, WorkDay } from "./workdays.ts";

/**
 * The work calendar: a month of work days, each with where its pay stands. The status is always a
 * word and a shape (colour only repeats it): the owner can't tell red from green.
 */

/** Weeks of the month, Sunday first; days outside the month are null. */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "2026-10" ± n months. */
export function shiftCalMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const isCalMonth = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export type CalStatus = DayStatus | "late";

/** A waiting day past the pay lag is "late"; everything else keeps its status. */
export const calStatus = (d: Pick<WorkDay, "status" | "late">): CalStatus => (d.status === "waiting" && d.late ? "late" : d.status);

/** Word and glyph per status. The glyphs differ in shape, not just colour. */
export const CAL_LABEL: Record<CalStatus, { word: string; glyph: string }> = {
  paid: { word: "Paid", glyph: "✓" },
  marked: { word: "Paid", glyph: "✓" },
  stub: { word: "Stub in", glyph: "◐" },
  waiting: { word: "Waiting", glyph: "○" },
  late: { word: "Late", glyph: "!" },
  scheduled: { word: "Booked", glyph: "◇" },
};

/** Counts for the month's summary line, in a fixed order. */
export function monthCounts(days: readonly WorkDay[], month: string): { status: CalStatus; count: number }[] {
  const order: CalStatus[] = ["paid", "stub", "waiting", "late", "scheduled"];
  const counts = new Map<CalStatus, number>();
  for (const d of days) {
    if (!d.day.startsWith(month)) continue;
    const s = calStatus(d) === "marked" ? "paid" : calStatus(d);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return order.filter((s) => counts.get(s)).map((s) => ({ status: s, count: counts.get(s)! }));
}

/** One bar in a week of the month: a run of days of one event with one status. */
export type WeekBar = { key: string; eventId: string; title: string; status: CalStatus; col: number; span: number; lane: number; stubId: string | null };

/**
 * The bars for one week row (Sunday first, nulls outside the month): each event's consecutive
 * days with the same status become one bar; bars are stacked into lanes so none overlap.
 */
export function weekBars(week: readonly (string | null)[], days: readonly WorkDay[]): WeekBar[] {
  const col = new Map(week.map((d, i) => [d, i] as const).filter(([d]) => d !== null) as [string, number][]);
  const byEvent = new Map<string, WorkDay[]>();
  for (const d of days) if (col.has(d.day)) (byEvent.get(d.eventId) ?? byEvent.set(d.eventId, []).get(d.eventId)!).push(d);
  const runs: Omit<WeekBar, "lane">[] = [];
  for (const [eventId, list] of byEvent) {
    const sorted = [...list].sort((a, b) => a.day.localeCompare(b.day));
    let cur: Omit<WeekBar, "lane"> | null = null;
    for (const d of sorted) {
      const c = col.get(d.day)!;
      const s = calStatus(d) === "marked" ? "paid" : calStatus(d);
      if (cur && cur.status === s && cur.col + cur.span === c) { cur.span++; continue; }
      if (cur) runs.push(cur);
      cur = { key: `${eventId}|${d.day}`, eventId, title: d.title, status: s, col: c, span: 1, stubId: d.stubId };
    }
    if (cur) runs.push(cur);
  }
  runs.sort((a, b) => a.col - b.col || b.span - a.span || a.title.localeCompare(b.title));
  const laneEnds: number[] = [];
  return runs.map((r) => {
    let lane = laneEnds.findIndex((end) => end <= r.col);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = r.col + r.span;
    return { ...r, lane };
  });
}

/** The work days of a month grouped by event (calendar job), in date order. */
export function monthJobs(days: readonly WorkDay[], month: string): { eventId: string; title: string; days: WorkDay[] }[] {
  const map = new Map<string, { eventId: string; title: string; days: WorkDay[] }>();
  for (const d of days) if (d.day.startsWith(month)) (map.get(d.eventId) ?? map.set(d.eventId, { eventId: d.eventId, title: d.title, days: [] }).get(d.eventId)!).days.push(d);
  return [...map.values()].map((j) => ({ ...j, days: j.days.sort((a, b) => a.day.localeCompare(b.day)) })).sort((a, b) => a.days[0].day.localeCompare(b.days[0].day));
}
