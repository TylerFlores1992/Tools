"use client";

import { useActionState } from "react";
import { Arrow, Button } from "@/components/Button";
import { State } from "@/components/State";
import { connect, importStatement, syncNow, type FormState } from "@/app/private/money/actions";

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

/** Upload a bank's CSV export for one account. Messages in words, in a live region. */
export function ImportForm({ accounts }: { accounts: Array<{ id: string; label: string }> }) {
  const [state, action, pending] = useActionState(importStatement, INITIAL);
  const field = "field min-h-11 w-full rounded-input border border-control bg-surface px-3 text-body text-ink";
  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">Account the file is from</span>
        <select name="account" required defaultValue="" className={field}>
          <option value="" disabled>Pick one</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">CSV file</span>
        <input type="file" name="file" required accept=".csv,text/csv" className="w-full min-w-0 text-small text-ink-2 file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-line-2 file:bg-surface-2 file:px-4 file:text-small file:text-ink" />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-small text-ink-2">
        <input type="checkbox" name="flip" className="size-5 accent-ink" />
        Flip signs (only if purchases came in as money in last time)
      </label>
      <p aria-live="polite" className="min-h-6 text-small">
        {state.error && <State kind="wrong">{state.error}</State>}
        {state.done && <State kind="ok">{state.done}</State>}
      </p>
      <Button type="submit" variant="quiet" disabled={pending} className="justify-self-start">
        {pending ? "Importing…" : "Import"}
      </Button>
    </form>
  );
}
