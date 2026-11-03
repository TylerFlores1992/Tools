"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

/**
 * "Try again" for a card that says the database didn't answer: asks the server for the same page
 * again (same address, same filters), with a spinner while it does.
 */
export function TryAgain({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      type="button"
      variant="quiet"
      className={className}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) start(() => router.refresh());
      }}
    >
      {busy ? <><Spinner />Trying again…</> : "Try again"}
    </Button>
  );
}
