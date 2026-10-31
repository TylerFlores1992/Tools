"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionResult } from "../types";
import { useToast } from "./toast-context";

export type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * A form whose server action updates the page in place (no navigation, so no jump to the top)
 * and reports back through the toast. A "Confirm" panel it sits in closes once it's done.
 */
export function ActionForm({ action, children, className }: { action: Action; children: ReactNode; className?: string }) {
  const [result, formAction] = useActionState(action, null);
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!result) return;
    toast(result);
    if (result.ok) ref.current?.closest("details")?.removeAttribute("open");
  }, [result, toast]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
    </form>
  );
}
