"use client";

import { useRef, type ReactNode } from "react";
import type { ActionResult } from "../types";
import { useToast } from "./toast-context";

export type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * A form whose server action updates the page in place (no navigation, so no jump to the top)
 * and reports back through the toast. A "Confirm" panel it sits in closes once it's done.
 *
 * The result goes straight to the toast from the action itself, not from an effect in this form:
 * a Delete or Stop refreshes the page, the row holding this form disappears, and an effect here
 * would never run, so the toast (and its Undo) never showed. The Toaster never unmounts.
 * `useFormStatus` still sees the form as pending, so the buttons inside say they're working.
 */
export function ActionForm({ action, children, className }: { action: Action; children: ReactNode; className?: string }) {
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        const panel = ref.current?.closest("details") ?? null; // found now: after the refresh the form may be gone
        const result = await action(null, fd);
        toast(result);
        if (result.ok) panel?.removeAttribute("open");
      }}
      className={className}
    >
      {children}
    </form>
  );
}
