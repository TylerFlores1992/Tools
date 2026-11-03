"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";

const noSubscribe = () => () => {};

/**
 * "Copy email" beside the mailto button, which does nothing visible on a machine with no mail
 * app. Swaps to "Copied ✓" for 2 s; if the browser refuses the clipboard, it says so and shows
 * the address to select instead. Rendered only once JavaScript runs (a copy button can't work
 * without it), and last in its row, so appearing never moves the buttons before it.
 */
export function CopyEmail({ email }: { email: string }) {
  const ready = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);
  if (!ready) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setState("copied");
    } catch {
      setState("failed");
    }
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button variant="quiet" onClick={copy}>
        {/* Both labels share one cell, so the button keeps its width when the words swap. */}
        <span className="grid">
          <span className="col-start-1 row-start-1">{state === "copied" ? <><span aria-hidden="true">✓</span> Copied</> : "Copy email"}</span>
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">Copy email</span>
        </span>
      </Button>
      <span role="status" className="text-small text-ink-2">
        {state === "copied" && <span className="sr-only">Email address copied.</span>}
        {state === "failed" && (
          <>This browser didn’t allow copying. The address is <span className="select-all text-ink">{email}</span>.</>
        )}
      </span>
    </span>
  );
}
