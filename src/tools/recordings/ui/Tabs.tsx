"use client";

import { useRef, useState, type ReactNode } from "react";

export type TabDef<K extends string> = { key: K; label: string; count: number };

/**
 * Upcoming / Library / Series / Trash. Every panel is already on the page, so switching is
 * instant: no page load, no fade, no jump to the top (owner, 2026-10-31). The address bar follows
 * (`?tab=`) so a reload or a shared link opens the same tab. Arrow keys move between tabs.
 */
export function Tabs<K extends string>({ tabs, initial, fallback, panels }: { tabs: TabDef<K>[]; initial: K; fallback?: K; panels: Record<K, ReactNode> }) {
  const [chosen, setTab] = useState<K>(initial);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // A tab can go away while open (Trash, once emptied): show the fallback instead.
  const has = (k?: K) => k !== undefined && tabs.some((t) => t.key === k);
  const tab = has(chosen) ? chosen : has(fallback) ? fallback! : tabs[0].key;

  function pick(k: K, focus = false) {
    setTab(k);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", k);
    for (const p of ["msg", "kind"]) url.searchParams.delete(p);
    window.history.replaceState(null, "", url); // null: Next keeps its router in step (docs: linking-and-navigating)
    if (focus) refs.current[tabs.findIndex((t) => t.key === k)]?.focus();
  }

  return (
    <>
      <div role="tablist" aria-label="Recordings" className="mt-10 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
        {tabs.map((t, i) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={on}
              aria-controls={`panel-${t.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(t.key)}
              onKeyDown={(e) => {
                const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                pick(tabs[(i + d + tabs.length) % tabs.length].key, true);
              }}
              className="flex min-h-10 items-center gap-2 rounded-full px-4 text-small whitespace-nowrap text-ink-2 transition-colors duration-150 hover:text-ink aria-selected:bg-primary aria-selected:text-on-primary"
            >
              {t.label}
              {t.count > 0 && <span className="tabular-nums">{t.count}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`} hidden={t.key !== tab} className="mt-6 max-w-[920px]">
          {panels[t.key]}
        </div>
      ))}
    </>
  );
}
