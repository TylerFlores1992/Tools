import { timingSafeEqual } from "node:crypto";
import { sha256 } from "@/lib/mail/secret";
import { isConfigured } from "@/lib/money/db";
import { getIncomeSettings, listEvents, listStubs, markRecolored, recordCalendarRun, replaceEvents } from "@/lib/money/income/store";
import { toLocalDate } from "@/tools/money/simplefin";
import type { WorkEvent } from "@/tools/money/income/types";
import { recolorIds, workDays } from "@/tools/money/income/workdays";

/**
 * The work-calendar Apps Script (src/tools/money/income/calendar-script.ts) talks to this. Public
 * by path; the key (stored as SHA-256 only, made on /private/money/income/settings) is the entire
 * access control, and a new key stops the old script. It answers with which events to recolour,
 * never with stored money data.
 */
export const maxDuration = 30;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function windowFor(today: string) {
  return { from: `${today.slice(0, 4)}-01-01`, to: addDays(today, 60) };
}

export async function POST(req: Request) {
  if (!isConfigured()) return json({ error: "not configured" }, 503);
  const settings = await getIncomeSettings();
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = !!given && !!settings.keyHash && (() => {
    const a = Buffer.from(sha256(given));
    const b = Buffer.from(settings.keyHash!);
    return a.length === b.length && timingSafeEqual(a, b);
  })();
  if (!ok) return json({ error: "unauthorized" }, 401);
  let p: Record<string, unknown>;
  try {
    p = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const today = toLocalDate(Date.now() / 1000);
  const { from, to } = windowFor(today);
  const { config } = settings;

  switch (p.op) {
    case "hello":
      // The script reads from 00:00 on `from` to 00:00 the day after `to`.
      return json({ from: `${from}T00:00:00`, to: `${addDays(to, 1)}T00:00:00`, colors: [config.workColor, config.paidColor] });
    case "events": {
      const raw = Array.isArray(p.events) ? p.events.slice(0, 2000) : [];
      const events: WorkEvent[] = raw
        .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
        .map((e) => ({
          eventId: String(e.key ?? "").slice(0, 400),
          title: String(e.title ?? "").slice(0, 200) || "Work",
          startDay: String(e.startDay ?? ""),
          endDay: String(e.endDay ?? ""),
          color: typeof e.color === "string" ? e.color.slice(0, 4) : null,
          recoloredAt: null,
        }))
        .filter((e) => e.eventId && DATE.test(e.startDay) && DATE.test(e.endDay) && e.endDay >= e.startDay);
      await replaceEvents(events, from, to);
      const stored = await listEvents();
      const days = workDays(stored, await listStubs(), config, today);
      return json({ stored: events.length, recolor: recolorIds(stored, days, config), paidColor: config.paidColor });
    }
    case "done": {
      const keys = (Array.isArray(p.recolored) ? p.recolored : []).filter((k): k is string => typeof k === "string").slice(0, 500);
      await markRecolored(keys, config.paidColor);
      await recordCalendarRun(p.summary ?? null);
      return json({ ok: true });
    }
    default:
      return json({ error: "unknown op" }, 400);
  }
}
