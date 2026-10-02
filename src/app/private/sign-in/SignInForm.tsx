"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Arrow, Button } from "@/components/Button";
import { State } from "@/components/State";
import { cx } from "@/components/cx";
import { signIn, type SignInState } from "../actions";

const MESSAGES: Record<NonNullable<SignInState["error"]>, string> = {
  empty: "Enter the password.",
  wrong: "That password didn’t work. Try again.",
  unset: "The private area isn’t set up yet.",
};

const INITIAL: SignInState = { attempt: 0 };

/**
 * One field: the password. No username, because there isn't one. Works without JavaScript (the
 * form posts to the Server Action); with it, errors appear in place and the field is ready for
 * another try.
 */
export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, INITIAL);
  const [show, setShow] = useState(false);
  // The attempt whose message the visitor has typed past; typing again clears it.
  const [dismissed, setDismissed] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const error = state.error && dismissed !== state.attempt ? MESSAGES[state.error] : "";

  // After a failed try the form resets; put the cursor back in the field.
  useEffect(() => {
    if (state.attempt > 0) input.current?.focus();
  }, [state.attempt]);

  return (
    <form action={action} noValidate className="grid gap-5">
      <input type="hidden" name="next" defaultValue={next} />
      <div className="grid gap-2">
        <label htmlFor="password" className="text-small text-ink-2">Password</label>
        <div className={cx("field flex min-h-14 items-center rounded-input border bg-surface transition-colors duration-150", error ? "border-wrong" : "border-control")}>
          <input
            ref={input}
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "password-error" : "password-hint"}
            onChange={() => setDismissed(state.attempt)}
            className="w-full min-w-0 flex-1 bg-transparent px-4 py-3 text-body text-ink outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            aria-controls="password"
            className="mr-1.5 flex min-h-11 items-center gap-2 rounded-btn px-3 text-small text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <EyeIcon open={!show} />
            {show ? "Hide" : "Show"}
            <span className="sr-only"> password</span>
          </button>
        </div>
        <p id="password-error" aria-live="polite" className="min-h-6 text-small">
          {error && <State kind="wrong">{error}</State>}
        </p>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Checking…" : <>Unlock <Arrow /></>}
      </Button>
      <p id="password-hint" className="text-small text-muted">You’ll stay signed in on this device for 30 days.</p>
    </form>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}
