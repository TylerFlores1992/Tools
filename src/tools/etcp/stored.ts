"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Study progress kept in this browser only. localStorage can be missing or throw (private
// windows, blocked storage), so a memory copy keeps the page working for the visit.
const memory = new Map<string, string>();
const EVENT = "fw-stored";

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/**
 * A JSON value in localStorage. The server render (and the first client render) use `fallback`,
 * so markup always hydrates cleanly; the saved value arrives right after. `fallback` must be a
 * stable reference (a module-level constant).
 */
export function useStored<T>(key: string, fallback: T, valid: (v: unknown) => v is T): [T, (next: T) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const value = useMemo(() => {
    if (raw == null) return fallback;
    try {
      const v: unknown = JSON.parse(raw);
      return valid(v) ? v : fallback;
    } catch {
      return fallback;
    }
  }, [raw, fallback, valid]);
  const set = useCallback(
    (next: T) => {
      const s = JSON.stringify(next);
      memory.set(key, s);
      try {
        localStorage.setItem(key, s);
      } catch {
        // Memory copy still holds it for this visit.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
