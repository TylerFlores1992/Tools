"use client";

import { useSyncExternalStore } from "react";
import type { SiteMapData } from "../maps";
import { EMPTY_DRAFT, draftOf, sameDraft, type TraceDraft } from "../maps/trace";

// A reviewer's traces, kept in this browser per map until they download the file (lab: there is
// no server to save to). A map with no saved draft starts from the trace built into it.

const KEY = "lab-site-map-traces";
const EVT = "lab-site-map-traces";

function readAll(): Record<string, TraceDraft> {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {}; } catch { return {}; }
}
let cache: { raw: string | null; value: Record<string, TraceDraft> } = { raw: null, value: {} };
function snapshot() {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { /* storage blocked: nothing saved */ }
  if (raw !== cache.raw) cache = { raw, value: readAll() };
  return cache.value;
}
const NONE: Record<string, TraceDraft> = {};
const subscribe = (on: () => void) => {
  window.addEventListener(EVT, on);
  window.addEventListener("storage", on);
  return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
};

function write(id: string, draft: TraceDraft | null) {
  const next = { ...readAll() };
  if (draft) next[id] = draft; else delete next[id];
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved */ }
  window.dispatchEvent(new Event(EVT));
}

/**
 * The draft for one map: [draft, set, changed, discard]. `changed` is true when the draft differs
 * from what is built into the map; `discard` goes back to that.
 */
export function useTraceDraft(id: string, map: SiteMapData | null): [TraceDraft, (d: TraceDraft) => void, boolean, () => void] {
  const all = useSyncExternalStore(subscribe, snapshot, () => NONE);
  const built = map ? draftOf(map) : EMPTY_DRAFT;
  const draft = all[id] ?? built;
  const set = (d: TraceDraft) => write(id, sameDraft(d, built) ? null : d);
  return [draft, set, !sameDraft(draft, built), () => write(id, null)];
}

/** The maps with traces saved in this browser that aren't built yet (the queue tags them). */
export function useSavedTraceIds(): Set<string> {
  const all = useSyncExternalStore(subscribe, snapshot, () => NONE);
  return new Set(Object.keys(all));
}
