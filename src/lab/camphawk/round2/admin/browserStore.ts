// A small store for what a reviewer does on the admin pages (decisions, traces), kept in memory
// first and in this browser's localStorage second. Memory is the source of truth: when storage is
// blocked (a private window, a strict browser setting) every click still shows, and `saveFailed()`
// lets the page say "Not saved in this browser" instead of claiming it was. Another tab's change
// arrives through the `storage` event and replaces the memory copy.

export type BrowserStore<T> = {
  /** The current value: the same object until something changes it (safe as a React snapshot). */
  get: () => T;
  /** Replace the value, then try to save it. */
  set: (next: T) => void;
  subscribe: (onChange: () => void) => () => void;
  /** True once storage refused a read or a write; false again after a write succeeds. */
  saveFailed: () => boolean;
};

export function createBrowserStore<T>(key: string, fallback: T, isValue: (x: unknown) => x is T): BrowserStore<T> {
  let value: T | undefined;
  let failed = false;
  const listeners = new Set<() => void>();
  const notify = () => { for (const l of listeners) l(); };
  const load = () => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw === null ? fallback : JSON.parse(raw);
      value = isValue(parsed) ? parsed : fallback;
    } catch (e) {
      // A refused read means nothing will save either; a malformed value is only a bad file.
      if (!(e instanceof SyntaxError)) failed = true;
      value = fallback;
    }
  };
  return {
    get: () => {
      if (value === undefined) load();
      return value as T;
    },
    set: (next) => {
      value = next;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
        failed = false;
      } catch {
        failed = true;
      }
      notify();
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      const onStorage = (e: StorageEvent) => { if (e.key === key || e.key === null) { load(); notify(); } };
      window.addEventListener("storage", onStorage);
      return () => { listeners.delete(onChange); window.removeEventListener("storage", onStorage); };
    },
    saveFailed: () => {
      if (value === undefined) load();
      return failed;
    },
  };
}

/** A plain object of string keys (what both stores hold). */
export const isRecord = (x: unknown): x is Record<string, never> => typeof x === "object" && x !== null && !Array.isArray(x);
