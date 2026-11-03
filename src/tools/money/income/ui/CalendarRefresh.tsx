"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { refreshCalendar } from "@/app/private/money/income/actions";
import { Spinner } from "@/components/Spinner";
import { State } from "@/components/State";

const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const POLL_MS = 5_000;
const GIVE_UP_MS = 150_000;

/**
 * "Calendar read 11:02 AM · Refresh". Refresh asks the script (version 2) to read on its next
 * one-minute wake, then reloads the page every few seconds until the read lands.
 */
export function CalendarRefresh({ lastRunAt, pending, scriptVersion, children }: { lastRunAt: string | null; pending: boolean; scriptVersion: number | null; children?: ReactNode }) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(pending);
  const [gaveUp, setGaveUp] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, start] = useTransition();
  const seen = useRef(lastRunAt);
  const started = useRef(0);

  useEffect(() => {
    if (lastRunAt !== seen.current) { seen.current = lastRunAt; setWaiting(false); }
  }, [lastRunAt]);

  useEffect(() => {
    if (!waiting) return;
    if (!started.current) started.current = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started.current > GIVE_UP_MS) { setWaiting(false); setGaveUp(true); clearInterval(t); return; }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [waiting, router]);

  const old = scriptVersion !== null && scriptVersion < 2;
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-2">
        <span>{lastRunAt ? `Calendar read ${WHEN.format(new Date(lastRunAt))}` : "Calendar connected, not read yet"}</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          disabled={busy || waiting}
          aria-busy={busy || waiting || undefined}
          onClick={() =>
            start(async () => {
              setFailed(false);
              setGaveUp(false);
              // A dropped connection throws; the database not answering returns false. Either way, say so.
              const ok = await refreshCalendar().catch(() => false);
              if (!ok) { setFailed(true); return; }
              started.current = Date.now();
              setWaiting(true);
            })
          }
          className="-mx-1 inline-flex min-h-11 items-center gap-2 rounded-btn px-1 text-ink-2 underline underline-offset-4 hover:text-ink disabled:no-underline"
        >
          {busy ? <><Spinner />Asking…</> : waiting ? <><Spinner />Reading your calendar…</> : "Refresh"}
        </button>
        {children ? <><span aria-hidden="true">·</span>{children}</> : null}
      </p>
      <p aria-live="polite">
        {waiting && old ? "Your script reads once a day; make the new one in Settings and Refresh works within a minute." : null}
        {gaveUp ? "No read in two and a half minutes. Open the script at script.google.com and check its last run." : null}
        {failed ? <State kind="wrong">Couldn’t ask for a read: the money database didn’t answer. Try again in a minute.</State> : null}
      </p>
    </div>
  );
}
