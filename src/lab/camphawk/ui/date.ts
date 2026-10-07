// Ported from campsite-finder src/components/ui/date.ts (2026-10-06). Dates are 'YYYY-MM-DD'
// strings parsed field by field into LOCAL dates: `new Date("2026-07-18")` is midnight UTC and
// renders as Jul 17 in every US timezone.
// Lab changes: "today" is pinned to the lab's story day (Jul 6, 2026, the same as the campground
// page), and `thisWeekendRange` reads the weekday with `parseISO`. CampHawk's copy calls
// `new Date(today).getDay()`, the UTC trap above, so in US timezones it gets the day before and
// "This weekend" lands on Saturday to Monday. Reported back; the lab has the fix.

export type ISODate = string;

/** The lab's "today". Every Golden hour screen tells the same story from this day. */
export const LAB_TODAY: ISODate = "2026-07-06";

const pad = (n: number) => String(n).padStart(2, "0");

export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const d = parseISO(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return toISO(d);
}

export function todayISO(): ISODate {
  return LAB_TODAY;
}

export function startOfMonth(iso: ISODate): ISODate {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function daysInMonth(iso: ISODate): number {
  const d = parseISO(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Weekday index (0 = Sunday) of the 1st of this month. */
export function firstDayOfWeek(iso: ISODate): number {
  const d = parseISO(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1).getDay();
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function nightsBetween(start: ISODate, end: ISODate): number {
  return Math.max(0, daysBetween(start, end));
}

export function isBefore(a: ISODate, b: ISODate): boolean {
  return a < b;
}

export function isWithin(day: ISODate, start: ISODate, end: ISODate): boolean {
  return day > start && day < end;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MO3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function monthLabel(iso: ISODate): string {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Sat Aug 29" */
export function shortDate(iso: ISODate): string {
  const d = parseISO(iso);
  return `${DOW3[d.getDay()]} ${MO3[d.getMonth()]} ${d.getDate()}`;
}

/** "Saturday, August 29, 2026" */
export function longDate(iso: ISODate): string {
  const d = parseISO(iso);
  return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Sat Aug 29 – Tue Sep 1", or "Sat Aug 29 – …" mid-selection. */
export function formatRange(start: ISODate | null, end: ISODate | null): string | null {
  if (!start) return null;
  if (!end) return `${shortDate(start)} – …`;
  return `${shortDate(start)} – ${shortDate(end)}`;
}

/** CampHawk's stay format, from formatStayDates, with the lab's en dash: "Jul 18–21", or
    "Jul 30 – Aug 2" across months (CampHawk uses a hyphen; every other range in the lab is a dash). */
export function stayDates(start: ISODate, end: ISODate): string {
  const a = parseISO(start), b = parseISO(end);
  return a.getMonth() === b.getMonth()
    ? `${MO3[a.getMonth()]} ${a.getDate()}–${b.getDate()}`
    : `${MO3[a.getMonth()]} ${a.getDate()} – ${MO3[b.getMonth()]} ${b.getDate()}`;
}

/** The coming Friday to Sunday (two nights). On a Friday it means today. */
export function thisWeekendRange(): { start: ISODate; end: ISODate } {
  const today = todayISO();
  const dow = parseISO(today).getDay();
  const start = addDays(today, (5 - dow + 7) % 7);
  return { start, end: addDays(start, 2) };
}
