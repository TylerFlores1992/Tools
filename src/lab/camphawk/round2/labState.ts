"use client";

import { useCallback, useSyncExternalStore } from "react";
import { VISITORS, type Visitor } from "../data";

// Lab switches that live in the URL (`?as=subscriber&state=empty`), so a reviewer can link to
// any state and the "View as" choice survives moving between Golden hour screens. Replaces the
// history entry rather than pushing: flipping a switch is not a page.

const EVENT = "lab-url-state";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** One URL parameter, limited to `allowed`; anything else reads as `fallback`. */
export function useUrlState<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const read = () => {
    const v = new URLSearchParams(window.location.search).get(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const set = useCallback((v: T) => {
    const url = new URL(window.location.href);
    if (v === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, v);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(EVENT));
  }, [key, fallback]);
  return [value, set];
}

export function useVisitor(): [Visitor, (v: Visitor) => void] {
  return useUrlState<Visitor>("as", "signed-out", VISITORS.map((v) => v.value));
}

/** A lab link that keeps who we're pretending to be. */
export function withVisitor(href: string, visitor: Visitor): string {
  if (visitor === "signed-out") return href;
  return `${href}${href.includes("?") ? "&" : "?"}as=${visitor}`;
}

/** A free-text URL parameter, read-only (null when absent). */
export function useUrlParam(key: string): string | null {
  return useSyncExternalStore(subscribe, () => new URLSearchParams(window.location.search).get(key), () => null);
}
