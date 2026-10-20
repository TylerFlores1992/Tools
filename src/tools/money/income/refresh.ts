/**
 * When the calendar script should read the calendar. The script (version 2+) wakes every minute
 * and asks; reading only when this says so keeps a minute-by-minute trigger cheap (one small
 * request) while a changed schedule still lands quickly:
 *   - the owner pressed Refresh since the last read: read now;
 *   - the last read is READ_EVERY_MIN old: read (a schedule change shows up within that);
 *   - never read: read.
 */
export const READ_EVERY_MIN = 15;

export function shouldRead(lastRunAt: string | null, refreshAt: string | null, nowMs: number): { read: boolean; why: "first" | "refresh" | "due" | "fresh" } {
  if (!lastRunAt) return { read: true, why: "first" };
  const last = Date.parse(lastRunAt);
  if (refreshAt && Date.parse(refreshAt) > last) return { read: true, why: "refresh" };
  if (nowMs - last >= READ_EVERY_MIN * 60_000) return { read: true, why: "due" };
  return { read: false, why: "fresh" };
}

/** A refresh still waiting for the script (pressed after the last read). */
export const refreshPending = (lastRunAt: string | null, refreshAt: string | null) =>
  !!refreshAt && (!lastRunAt || Date.parse(refreshAt) > Date.parse(lastRunAt));
