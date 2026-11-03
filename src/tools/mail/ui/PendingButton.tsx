"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/components/cx";
import { Spinner } from "@/components/Spinner";

/**
 * A form's submit button that says it is working while the server action runs (re-sorting takes
 * up to a minute). It takes a ready-made class string; for a plain button prefer the shared
 * `SubmitButton`. While busy it shows a spinner and its `pending` words, refuses a second press,
 * and stays at full strength (aria-disabled, not `disabled`), so it reads as "working" and keeps
 * keyboard focus.
 */
export function PendingButton({ children, pending, className }: { children: ReactNode; pending: ReactNode; className?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button
      type="submit"
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (busy) e.preventDefault();
      }}
      className={cx(className, busy && "cursor-progress")}
    >
      {busy ? (
        <>
          <Spinner />
          {pending}
        </>
      ) : (
        children
      )}
    </button>
  );
}
