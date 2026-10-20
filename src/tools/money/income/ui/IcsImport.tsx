"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { previewIcs, saveIcs, type IcsPreview } from "@/app/private/money/income/actions";

const FIELD = "field min-h-11 w-full min-w-0 rounded-input border border-control bg-surface px-3 text-body text-ink";
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmt = (d: string) => DAY.format(new Date(`${d}T00:00:00Z`));

/**
 * Importing work days from an older calendar: choose the .ics file (or paste its link), see every
 * event in the dates given, untick what isn't work, save. Two steps, so nothing lands unseen.
 */
export function IcsImport({ defaultFrom, defaultBefore }: { defaultFrom: string; defaultBefore: string }) {
  const [state, action, pending] = useActionState<IcsPreview, FormData>(previewIcs, { attempt: 0 });
  const events = useMemo(() => state.events ?? [], [state.events]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(0);
  // A new preview starts with everything ticked.
  if (shown !== state.attempt) { setShown(state.attempt); setOff(new Set()); }
  const key = (i: number) => `${events[i].uid}|${events[i].startDay}`;
  const picked = events.filter((_, i) => !off.has(key(i))).length;

  return (
    <div className="grid gap-4">
      <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-small text-ink-2">Calendar file (.ics)</span>
          <input type="file" name="file" accept=".ics,text/calendar" className="text-small text-ink-2 file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-line-2 file:bg-surface file:px-4 file:text-ink" />
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-small text-ink-2">Or the calendar&rsquo;s share link (.ics or webcal://)</span>
          <input name="link" type="url" inputMode="url" placeholder="https://…/calendar.ics" className={`${FIELD} placeholder:text-muted`} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-small text-ink-2">Events starting on or after</span>
          <input type="date" name="from" defaultValue={state.from ?? defaultFrom} required className={FIELD} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-small text-ink-2">and before</span>
          <input type="date" name="before" defaultValue={state.before ?? defaultBefore} required className={FIELD} />
        </label>
        <Button type="submit" variant="quiet" disabled={pending} className="justify-self-start">{pending ? "Reading…" : "Show the events"}</Button>
      </form>

      {state.error && <p role="alert" className="text-small text-wrong">! {state.error}</p>}

      {state.events && (
        <form action={saveIcs} className="grid gap-3">
          <p className="text-body text-ink-2" aria-live="polite">
            {events.length === 0 ? "No events in those dates." : `${events.length} ${events.length === 1 ? "event" : "events"} found. Untick anything that isn't work.`}
            {state.repeating ? ` ${state.repeating} repeating ${state.repeating === 1 ? "event was" : "events were"} left out.` : ""}
            {state.outside ? ` ${state.outside} outside the dates.` : ""}
          </p>
          {events.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-small">
                <button type="button" onClick={() => setOff(new Set())} className="min-h-11 rounded-btn px-2 text-ink-2 underline underline-offset-4 hover:text-ink">Tick all</button>
                <button type="button" onClick={() => setOff(new Set(events.map((_, i) => key(i))))} className="min-h-11 rounded-btn px-2 text-ink-2 underline underline-offset-4 hover:text-ink">Untick all</button>
              </div>
              <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto rounded-card border border-line bg-surface">
                {events.map((e, i) => (
                  <li key={key(i)}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-surface-2">
                      <input
                        type="checkbox" name="pick" value={JSON.stringify(e)} checked={!off.has(key(i))}
                        onChange={(ev) => setOff((o) => { const n = new Set(o); if (ev.target.checked) n.delete(key(i)); else n.add(key(i)); return n; })}
                        className="size-5 shrink-0 accent-ink"
                      />
                      <span className="min-w-0 flex-1 truncate text-body text-ink">{e.title}</span>
                      <span className="shrink-0 text-small tabular-nums text-ink-2">{e.startDay === e.endDay ? fmt(e.startDay) : `${fmt(e.startDay)} – ${fmt(e.endDay)}`}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <label className="flex min-h-11 items-center gap-3 text-body">
                <input type="checkbox" name="paid" defaultChecked className="size-5 accent-ink" />
                Days no saved stub covers were already paid (mark them paid, not waiting)
              </label>
              <Button type="submit" className="justify-self-start" disabled={picked === 0}>Import {picked} {picked === 1 ? "event" : "events"}</Button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
