"use client";

import { useSyncExternalStore } from "react";
import type { SiteMapData } from "../maps";
import { EMPTY_DRAFT, draftOf, sameDraft, type TraceDraft } from "../maps/trace";
import { createBrowserStore, isRecord } from "./browserStore";

// A reviewer's traces, kept in this browser per map until they download the file (lab: there is
// no server to save to). A map with no saved draft starts from the trace built into it.

// Memory first, this browser second (browserStore.ts): with storage blocked, tracing still works
// and the list says it isn't saved.
const store = createBrowserStore<Record<string, TraceDraft>>("lab-site-map-traces", {}, isRecord as (x: unknown) => x is Record<string, TraceDraft>);
const NONE: Record<string, TraceDraft> = {};

function write(id: string, draft: TraceDraft | null) {
  const next = { ...store.get() };
  if (draft) next[id] = draft; else delete next[id];
  store.set(next);
}

/** False when this browser refused to save the traces (they last only until the page closes). */
export function useTracesSaved(): boolean {
  return !useSyncExternalStore(store.subscribe, store.saveFailed, () => false);
}

/**
 * The draft for one map: [draft, set, changed, discard]. `changed` is true when the draft differs
 * from what is built into the map; `discard` goes back to that.
 */
export function useTraceDraft(id: string, map: SiteMapData | null): [TraceDraft, (d: TraceDraft) => void, boolean, () => void] {
  const all = useSyncExternalStore(store.subscribe, store.get, () => NONE);
  const built = map ? draftOf(map) : EMPTY_DRAFT;
  const draft = all[id] ?? built;
  const set = (d: TraceDraft) => write(id, sameDraft(d, built) ? null : d);
  return [draft, set, !sameDraft(draft, built), () => write(id, null)];
}

/** The maps with traces saved in this browser that aren't built yet (the queue tags them). */
export function useSavedTraceIds(): Set<string> {
  const all = useSyncExternalStore(store.subscribe, store.get, () => NONE);
  return new Set(Object.keys(all));
}
