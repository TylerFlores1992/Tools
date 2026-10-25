"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** A form's submit button that says it is working while the server action runs (re-sorting takes up to a minute). */
export function PendingButton({ children, pending, className }: { children: ReactNode; pending: ReactNode; className?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} aria-busy={busy} className={className}>
      {busy ? pending : children}
    </button>
  );
}
