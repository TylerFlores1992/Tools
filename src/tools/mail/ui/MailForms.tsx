"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { Arrow, Button } from "@/components/Button";
import { State } from "@/components/State";
import { SubmitButton } from "@/components/SubmitButton";
import { addYahoo, createRule, makeGmailScript, runNow, type FormState } from "@/app/private/mail/actions";

const INITIAL: FormState = { attempt: 0 };
const FIELD = "field min-h-11 w-full rounded-input border border-control bg-surface px-3 text-body text-ink placeholder:text-muted";

/** The form's outcome. Keyed on the attempt, so the same message twice in a row is still announced. */
function Status({ state }: { state: FormState }) {
  return (
    <p aria-live="polite" className="min-h-6 text-small">
      {state.error && <State key={state.attempt} kind="wrong">{state.error}</State>}
      {state.done && <State key={state.attempt} kind="ok">{state.done}</State>}
    </p>
  );
}

export function GmailScriptForm({ connected }: { connected: boolean }) {
  const [state, action] = useActionState(makeGmailScript, INITIAL);
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-4">
      <form action={action}>
        <SubmitButton variant={connected ? "quiet" : "primary"} pending="Making…">
          {connected ? "Make a new script (replaces the old one)" : <>Make my Gmail script <Arrow /></>}
        </SubmitButton>
      </form>
      <Status state={state} />
      {state.script && (
        <div className="grid gap-3">
          <ol className="grid list-decimal gap-1.5 pl-5 text-body text-ink-2 marker:text-muted">
            <li>Open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">a new Apps Script project</a> while signed in to the Gmail account.</li>
            <li>Delete what&rsquo;s there and paste the script below.</li>
            <li>Choose <span className="text-ink">setup</span> in the function menu, press Run, and allow access to Gmail.</li>
          </ol>
          <textarea readOnly value={state.script} rows={8} aria-label="Gmail script" className="field w-full rounded-input border border-control bg-surface p-3 font-mono text-small text-ink" />
          <Button
            type="button"
            variant="quiet"
            className="justify-self-start"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.script ?? "");
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "✓ Copied" : "Copy script"}
          </Button>
          <p className="text-small text-muted">The key inside is shown only now. If you lose it, make a new script.</p>
        </div>
      )}
    </div>
  );
}

export function YahooForm() {
  const [state, action] = useActionState(addYahoo, INITIAL);
  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">Yahoo address</span>
        {/* Keyed on the attempt so a failed try puts the address back (React empties the form after each try). */}
        <input key={state.attempt} name="address" type="email" defaultValue={state.error ? state.values?.address : undefined} autoComplete="off" autoCapitalize="none" placeholder="name@yahoo.com" className={FIELD} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">App password</span>
        <input name="appPassword" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="16 letters from Yahoo" className={FIELD} />
      </label>
      <Status state={state} />
      <SubmitButton pending="Signing in to Yahoo…" className="justify-self-start">Add account</SubmitButton>
    </form>
  );
}

export function RuleForm() {
  const [state, action] = useActionState(createRule, INITIAL);
  const [act, setAct] = useState("trash");
  const kept = state.error ? state.values : undefined; // a failed try keeps what was typed
  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">From contains</span>
        <input key={`f${state.attempt}`} name="matchFrom" defaultValue={kept?.matchFrom} placeholder="zillow.com" className={FIELD} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">Subject contains</span>
        <input key={`s${state.attempt}`} name="matchSubject" defaultValue={kept?.matchSubject} placeholder="market update" className={FIELD} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">Then</span>
        <select name="action" value={act} onChange={(e) => setAct(e.target.value)} className={FIELD}>
          <option value="trash">Move to Trash</option>
          <option value="file">File in a folder</option>
          <option value="unsubscribe">Unsubscribe and trash</option>
          <option value="hide">Ignore (leave it, don&rsquo;t list it)</option>
          <option value="important">Always list under Needs you</option>
        </select>
      </label>
      {act === "file" ? (
        <label className="grid gap-1.5">
          <span className="text-small text-ink-2">Folder</span>
          <input key={`d${state.attempt}`} name="folder" defaultValue={kept?.folder} placeholder="Misc" className={FIELD} />
        </label>
      ) : <span className="hidden sm:block" />}
      <div className="sm:col-span-2"><Status state={state} /></div>
      <SubmitButton pending="Saving…" className="justify-self-start">Save rule</SubmitButton>
    </form>
  );
}

export function RunNowForm() {
  const [state, action] = useActionState(runNow, INITIAL);
  return (
    <form action={action} className="grid gap-2">
      <SubmitButton variant="quiet" pending="Checking Yahoo…" className="justify-self-start">Check Yahoo now</SubmitButton>
      <Status state={state} />
    </form>
  );
}

// ---- removing an account or a rule ----

type Outcome = { ok: boolean; message: string; at: number };
const RemovedContext = createContext<(o: Outcome) => void>(() => {});

/**
 * Holds the "Removed …" note for a list. The note lives here, above the list, because the row
 * you removed (and the button in it) is gone once the page refreshes.
 */
export function RemoveArea({ children }: { children: ReactNode }) {
  const [last, setLast] = useState<Outcome | null>(null);
  return (
    <RemovedContext.Provider value={setLast}>
      <p aria-live="polite" className="text-small empty:hidden">
        {last && <State key={last.at} kind={last.ok ? "ok" : "wrong"}>{last.message}</State>}
      </p>
      {children}
    </RemovedContext.Provider>
  );
}

/** A Remove button that asks first, says "Removing…" while it works, and leaves a note in its `RemoveArea`. */
export function RemoveButton({ id, label, confirm, action }: { id: string | number; label: string; confirm: string; action: (form: FormData) => Promise<{ ok: boolean; message: string }> }) {
  const report = useContext(RemovedContext);
  return (
    <form
      action={async (fd) => {
        const r = await action(fd);
        report({ ...r, at: Date.now() });
      }}
    >
      <input type="hidden" name="id" value={String(id)} />
      <SubmitButton variant="ghost" pending="Removing…" confirm={confirm}>
        Remove<span className="sr-only"> {label}</span>
      </SubmitButton>
    </form>
  );
}
