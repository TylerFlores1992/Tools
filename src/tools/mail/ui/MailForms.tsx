"use client";

import { useActionState, useState } from "react";
import { Arrow, Button } from "@/components/Button";
import { State } from "@/components/State";
import { addYahoo, createRule, makeGmailScript, runNow, type FormState } from "@/app/private/mail/actions";

const INITIAL: FormState = { attempt: 0 };
const FIELD = "field min-h-11 w-full rounded-input border border-control bg-surface px-3 text-body text-ink placeholder:text-muted";

function Status({ state }: { state: FormState }) {
  return (
    <p aria-live="polite" className="min-h-6 text-small">
      {state.error && <State kind="wrong">{state.error}</State>}
      {state.done && <State kind="ok">{state.done}</State>}
    </p>
  );
}

export function GmailScriptForm({ connected }: { connected: boolean }) {
  const [state, action, pending] = useActionState(makeGmailScript, INITIAL);
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-4">
      <form action={action}>
        <Button type="submit" variant={connected ? "quiet" : "primary"} disabled={pending}>
          {pending ? "Making…" : connected ? "Make a new script (replaces the old one)" : <>Make my Gmail script <Arrow /></>}
        </Button>
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
  const [state, action, pending] = useActionState(addYahoo, INITIAL);
  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">Yahoo address</span>
        <input name="address" type="email" autoComplete="off" autoCapitalize="none" placeholder="name@yahoo.com" className={FIELD} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">App password</span>
        <input name="appPassword" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="16 letters from Yahoo" className={FIELD} />
      </label>
      <Status state={state} />
      <Button type="submit" disabled={pending} className="justify-self-start">{pending ? "Signing in to Yahoo…" : "Add account"}</Button>
    </form>
  );
}

export function RuleForm() {
  const [state, action, pending] = useActionState(createRule, INITIAL);
  const [act, setAct] = useState("trash");
  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">From contains</span>
        <input name="matchFrom" placeholder="zillow.com" className={FIELD} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">Subject contains</span>
        <input name="matchSubject" placeholder="market update" className={FIELD} />
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
          <input name="folder" placeholder="Misc" className={FIELD} />
        </label>
      ) : <span className="hidden sm:block" />}
      <div className="sm:col-span-2"><Status state={state} /></div>
      <Button type="submit" disabled={pending} className="justify-self-start">Save rule</Button>
    </form>
  );
}

export function RunNowForm() {
  const [state, action, pending] = useActionState(runNow, INITIAL);
  return (
    <form action={action} className="grid gap-2">
      <Button type="submit" variant="quiet" disabled={pending} className="justify-self-start">{pending ? "Checking Yahoo…" : "Check Yahoo now"}</Button>
      <Status state={state} />
    </form>
  );
}
