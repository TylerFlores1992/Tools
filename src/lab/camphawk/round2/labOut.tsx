"use client";

import { useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

// Lab feedback for presses that would leave CampHawk (Book, check out on the provider, the App
// Store's Terms) or that the lab can't finish: instead of a dead "#" that jumps the page to the
// top, the press says, in one status line, what the real product would do. One line for the whole
// page (mounted by the lab bar), so the live region exists before anything is said into it.

let message = "";
let seq = 0;
const listeners = new Set<() => void>();
let timer: number | undefined;

function emit() {
  for (const l of listeners) l();
}

/** Say something in the lab's status line for a few seconds. */
export function labSay(text: string) {
  message = text;
  seq += 1;
  emit();
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(() => { message = ""; emit(); }, 5000);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** "Lab: this would open Recreation.gov." */
export const wouldOpen = (where: string) => `Lab: this would open ${where}.`;

/** A press handler for a link that would leave CampHawk: no jump, a status line instead. */
export function stayHere(where: string) {
  return (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    labSay(wouldOpen(where));
  };
}

/** A link that would leave CampHawk. It keeps its look and its name, but a press stays in the lab
    and says where it would have gone. */
export function OutLink({ where, className, children, "aria-label": ariaLabel }: { where: string; className?: string; children: ReactNode; "aria-label"?: string }) {
  return <a href="#" aria-label={ariaLabel} onClick={stayHere(where)} className={className}>{children}</a>;
}

/** The status line itself: fixed near the bottom of the screen, above the home indicator. */
export function LabToast() {
  // The snapshot carries the press count, so the same words said twice still re-announce.
  const snap = useSyncExternalStore(subscribe, () => (message ? `${seq}|${message}` : ""), () => "");
  const cut = snap.indexOf("|");
  const key = snap.slice(0, cut);
  const text = snap.slice(cut + 1);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      {snap && (
        <p key={key} className="pointer-events-auto flex max-w-[60ch] items-start gap-2.5 rounded-ch-input border border-ch-white/30 bg-ch-forest px-4 py-3 text-[15px] leading-snug text-ch-white shadow-ch-pop">
          {text}
        </p>
      )}
    </div>
  );
}

/** For the older concept boards (the first home lab, Trail poster): their "#" links were never
    wired. Put on the board's root as onClickCapture, a press stays put (no jump to the top) and
    says so, instead of looking like a broken link. */
export function conceptBoardClicks(e: MouseEvent<HTMLElement>) {
  const a = (e.target as HTMLElement).closest?.('a[href="#"]');
  if (!a) return;
  e.preventDefault();
  labSay("Concept board: links are not wired.");
}
