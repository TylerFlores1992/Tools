"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Takes one-time notes ("Saved.", "Imported 12 events", "Disconnected") out of the address once
 * they've been shown, so a reload or a shared link doesn't show them again. The note itself stays
 * on screen until the next navigation. Renders nothing.
 */
export function ClearQuery({ keys }: { keys: readonly string[] }) {
  const joined = keys.join(",");
  // Re-run when the address changes too: an action that redirects back to the same page (Save on
  // Settings) brings a new note without remounting this component.
  const search = useSearchParams().toString();
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of joined.split(",")) {
      if (key && url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [joined, search]);
  return null;
}
