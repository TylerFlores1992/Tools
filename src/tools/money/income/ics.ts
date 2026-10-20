/**
 * Reading an exported calendar (.ics), for work days kept in another calendar before the Google
 * one (the owner used Yahoo until 2026-10-05). Pure. Only what the work calendar needs: a stable
 * id, the title, and the first and last day in Pacific time.
 *
 * All-day events end the day before DTEND (DTEND is exclusive). A timed event's last day is the
 * day its last second falls on, so a night shift to 2 AM covers two days and one ending at
 * midnight covers one. Repeating events (RRULE) and cancelled ones are counted and left out:
 * a work booking is a one-off event.
 */

export type IcsEvent = { uid: string; title: string; startDay: string; endDay: string };
export type IcsResult = { events: IcsEvent[]; repeating: number; canceled: number; outside: number };

const TZ = "America/Los_Angeles";
const PACIFIC = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Lines with folding undone (RFC 5545: a line starting with a space or tab continues the last). */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

const unescape = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

type Prop = { name: string; params: Record<string, string>; value: string };
function prop(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const [name, ...rest] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rest) { const [k, v] = p.split("="); if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, ""); }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The Pacific day of a DTSTART/DTEND value. `endOf` = the value is an exclusive end, so take the
 * day before (all-day) or the day of the second before (timed).
 */
export function icsDay(p: Prop, endOf = false): string | null {
  const v = p.value.trim();
  const date = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (date || p.params.VALUE === "DATE") {
    const m = date ?? v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    const d = `${m[1]}-${m[2]}-${m[3]}`;
    return endOf ? addDays(d, -1) : d;
  }
  const t = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!t) return null;
  const [, y, mo, d, h, mi, s, z] = t;
  if (z) {
    // UTC: the Pacific calendar day of that instant.
    const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - (endOf ? 1000 : 0);
    return PACIFIC.format(new Date(ms));
  }
  // Floating or TZID time: the wall-clock date as written (the work calendar is one time zone).
  if (endOf && h === "00" && mi === "00" && s === "00") return addDays(`${y}-${mo}-${d}`, -1);
  return `${y}-${mo}-${d}`;
}

/** Events whose first day is in [from, before). */
export function parseIcs(text: string, from: string, before: string): IcsResult {
  const out: IcsResult = { events: [], repeating: 0, canceled: 0, outside: 0 };
  let cur: Prop[] | null = null;
  let depth = 0;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") { cur = []; depth = 0; continue; }
    if (!cur) continue;
    if (line.startsWith("BEGIN:")) { depth++; continue; } // VALARM inside the event
    if (line.startsWith("END:") && line !== "END:VEVENT") { depth--; continue; }
    if (line === "END:VEVENT") {
      const get = (n: string) => cur!.find((p) => p.name === n) ?? null;
      const start = get("DTSTART");
      const end = get("DTEND");
      const uid = get("UID")?.value.trim() ?? "";
      const startDay = start ? icsDay(start) : null;
      if (get("RRULE")) out.repeating++;
      else if (/^cancell?ed$/i.test(get("STATUS")?.value ?? "")) out.canceled++;
      else if (startDay && uid) {
        let endDay = end ? icsDay(end, true) ?? startDay : startDay;
        if (endDay < startDay) endDay = startDay;
        if (startDay < from || startDay >= before) out.outside++;
        else out.events.push({ uid: uid.slice(0, 300), title: unescape(get("SUMMARY")?.value ?? "").slice(0, 200) || "Work", startDay, endDay: endDay > addDays(startDay, 61) ? addDays(startDay, 61) : endDay });
      }
      cur = null;
      continue;
    }
    if (depth === 0) { const p = prop(line); if (p) cur.push(p); }
  }
  out.events.sort((a, b) => a.startDay.localeCompare(b.startDay) || a.title.localeCompare(b.title));
  return out;
}

/** The work-event id for an imported event: kept apart from the Google script's ids. */
export const icsEventId = (e: Pick<IcsEvent, "uid" | "startDay">) => `ics:${e.uid}|${e.startDay}`;
export const isImportedEvent = (eventId: string) => eventId.startsWith("ics:");
