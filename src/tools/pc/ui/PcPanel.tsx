"use client";

import { useActionState, useEffect, useState } from "react";
import { State } from "@/components/State";
import { SubmitButton } from "@/components/SubmitButton";
import { pcAwake, wakePc, type WakeResult } from "@/app/private/pc/actions";
import { pcView } from "../status";

/** The PC's state and the Wake button. While waking it asks every 5 seconds, for 3 minutes. */
export function PcPanel({ initialAwake }: { initialAwake: boolean }) {
  const [awake, setAwake] = useState(initialAwake);
  const [res, act] = useActionState<WakeResult | null>(wakePc, null);
  const [now, setNow] = useState(() => Date.now());
  const [problem, setProblem] = useState<string | null>(null);
  const wokeAt = res?.sentAt ?? null;
  const shownAwake = awake || !!res?.awake;
  const view = pcView(shownAwake, wokeAt, now);

  useEffect(() => {
    if (view.kind !== "waking") return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const s = await pcAwake();
      setProblem(s.ok ? null : (s.message ?? null));
      if (s.awake) setAwake(true);
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [view.kind]);

  return (
    <div>
      <p className="text-h3" role="status" aria-live="polite">
        <State kind={view.kind === "on" ? "ok" : view.kind === "gave-up" ? "wrong" : "note"} sr="PC:">
          {view.text}
        </State>
      </p>
      {res && !res.ok ? (
        <p className="mt-3 text-body">
          <State kind="wrong">{res.message}</State>
        </p>
      ) : res?.ok && !res.sentAt && !res.awake ? (
        <p className="mt-3 text-body text-ink-2">{res.message}</p>
      ) : null}
      {problem ? <p className="mt-3 text-small text-ink-2">{problem}</p> : null}
      {view.kind !== "on" ? (
        <form action={act} className="mt-6">
          <SubmitButton pending="Sending…" disabled={view.kind === "waking"}>
            {view.kind === "gave-up" ? "Try waking it again" : "Wake my PC"}
          </SubmitButton>
        </form>
      ) : (
        <p className="mt-4 max-w-[60ch] text-body text-ink-2">Go back to Rig Studio and start the job. The PC goes back to sleep by itself after 30 quiet minutes.</p>
      )}
    </div>
  );
}
