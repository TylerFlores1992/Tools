"use client";

import { useActionState } from "react";
import { Arrow, Button } from "@/components/Button";
import { State } from "@/components/State";
import { connect, syncNow, type FormState } from "@/app/private/money/actions";

const INITIAL: FormState = { attempt: 0 };

/** Paste the SimpleFIN setup token. Works without JavaScript; errors appear in words. */
export function ConnectForm({ reconnect }: { reconnect: boolean }) {
  const [state, action, pending] = useActionState(connect, INITIAL);
  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2">
        <span className="text-small text-ink-2">Setup token from SimpleFIN Bridge</span>
        <textarea
          name="token"
          required
          rows={3}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="token-status"
          className="field w-full rounded-input border border-control bg-surface px-4 py-3 font-mono text-small break-all text-ink"
        />
      </label>
      <p id="token-status" aria-live="polite" className="min-h-6 text-small">
        {state.error && <State kind="wrong">{state.error}</State>}
        {state.done && <State kind="note">{state.done}</State>}
      </p>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">
        {pending ? "Connecting and syncing…" : <>{reconnect ? "Replace connection" : "Connect"} <Arrow /></>}
      </Button>
    </form>
  );
}

export function SyncNowForm() {
  const [state, action, pending] = useActionState(syncNow, INITIAL);
  return (
    <form action={action} className="grid gap-3">
      <Button type="submit" variant="quiet" disabled={pending} className="justify-self-start">
        {pending ? "Syncing…" : "Sync now"}
      </Button>
      <p aria-live="polite" className="min-h-6 text-small">
        {state.error && <State kind="wrong">{state.error}</State>}
        {state.done && <State kind="ok">{state.done}</State>}
      </p>
    </form>
  );
}
