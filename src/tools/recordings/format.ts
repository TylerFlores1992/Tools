import type { Ads, Rule, Upcoming } from "./types.ts";

/**
 * Words and times for the Recordings pages. Everything is shown in Pacific time: the DVR, the TV
 * guide and the owner all live there, and the page is rendered on Vercel's servers (UTC).
 */
export const TZ = "America/Los_Angeles";

const dayKey = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
const hour = (t: number) => Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(t));

/** Whole days between two moments' Pacific calendar dates (DST-proof: compares the dates). */
export function daysApart(t: number, now: number): number {
  return Math.round((Date.parse(`${dayKey(t)}T12:00:00Z`) - Date.parse(`${dayKey(now)}T12:00:00Z`)) / 86400000);
}

export const clock = (t: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(t);
export const shortDate = (t: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(t);
const longDate = (t: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "short", day: "numeric" }).format(t);

/** A day heading: "Tonight", "Today", "Tomorrow", or "Wednesday, Nov 4". */
export function dayLabel(t: number, now: number): string {
  const d = daysApart(t, now);
  if (d === 0) return hour(t) >= 17 ? "Tonight" : "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return longDate(t);
}

/** "Today, 8:00 PM", "Tomorrow, 9:30 PM", "Wed, Nov 4, 8:00 PM". */
export function when(t: number, now: number): string {
  const d = daysApart(t, now);
  const day = d === 0 ? "Today" : d === 1 ? "Tomorrow" : d === -1 ? "Yesterday" : shortDate(t);
  return `${day}, ${clock(t)}`;
}

/** "in 25 min", "in 5 h", "in 3 days". */
export function relIn(t: number, now: number): string {
  const m = Math.round((t - now) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.round(m / 60);
  return h < 36 ? `in ${h} h` : `in ${Math.round(h / 24)} days`;
}

export function size(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

/** "1 episode", "3 episodes", "2 series". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 || word.endsWith("s") ? "" : "s"}`;
}

export type DayGroup = { label: string; items: Upcoming[] };

/** Upcoming recordings under day headings, whatever is recording first. */
export function groupByDay(items: readonly Upcoming[], now: number): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const u of [...items].sort((a, b) => (a.state === "recording" ? -1 : 0) - (b.state === "recording" ? -1 : 0) || a.from - b.from)) {
    const label = u.state === "recording" ? "Recording now" : dayLabel(u.start, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(u);
    else groups.push({ label, items: [u] });
  }
  return groups;
}

/** "2 min early · 15 min late", from the rule's own padding or the default. */
export function padText(rule: Pick<Rule, "padBeforeMin" | "padAfterMin">, defaults: { padBeforeMin: number; padAfterMin: number }): string {
  return `${rule.padBeforeMin ?? defaults.padBeforeMin} min early · ${rule.padAfterMin ?? defaults.padAfterMin} min late`;
}

/** What to say about an episode's ads. `ok` = done well, `note` = neutral. Never colour alone. */
export function adsText(ads: Ads): { kind: "ok" | "note"; text: string } {
  if (ads.state === "removed") return { kind: "ok", text: `Ad-free · ${ads.savedMin ?? 0} min of ads removed` };
  if (ads.state === "pending") return { kind: "note", text: "Removing ads…" };
  if (ads.state === "full") return { kind: "note", text: "Full version, with ads" };
  return { kind: "note", text: "Has ads" };
}

/** A clash warning for an upcoming recording, or null. */
export function clash(u: Pick<Upcoming, "overlap" | "state">, lines: number): string | null {
  if (u.state === "skipped" || !u.overlap) return null;
  if (u.overlap > lines) return `Clashes with another channel: only ${plural(lines, "line")}, so one will be cut`;
  if (u.overlap > 1 && u.overlap === lines) return `Uses all ${lines} lines while it records`;
  return null;
}
