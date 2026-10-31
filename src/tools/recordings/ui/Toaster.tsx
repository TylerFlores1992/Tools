"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import { cx } from "@/components/cx";
import { State } from "@/components/State";
import type { ActionResult } from "../types";
import { ActionForm, type Action } from "./ActionForm";
import { ToastContext } from "./toast-context";

/**
 * The Recordings page's messages: one toast at the bottom of the screen, so a button's outcome
 * shows up where you are instead of at the top of the page. Undo, when there is one, is a real
 * form (the same server actions as the page's buttons).
 */
type Show = (r: ActionResult) => void;

export function Toaster({ children, undelete, unskip }: { children: ReactNode; undelete: Action; unskip: Action }) {
  const [toast, setToast] = useState<ActionResult | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<Show>((r) => {
    setToast(r);
    setShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), r.undo ? 9000 : r.ok ? 4500 : 8000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
        {toast && (
          <div
            key={toast.at}
            className={cx(
              "pointer-events-auto flex max-w-[560px] flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line-2 bg-surface-2 py-3 pl-5 pr-3 text-small shadow-card transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
              shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <State kind={toast.ok ? "ok" : "wrong"} className="min-w-0 flex-1">{toast.message}</State>
            {toast.undo && shown && (
              <ActionForm action={toast.undo.kind === "undelete" ? undelete : unskip}>
                <input type="hidden" name={toast.undo.kind === "undelete" ? "id" : "key"} value={toast.undo.value} />
                <button type="submit" className={buttonClasses("quiet", "min-h-10 px-4 text-small")}>Undo</button>
              </ActionForm>
            )}
            <button type="button" onClick={() => setShown(false)} aria-label="Dismiss" className={buttonClasses("ghost", "min-h-10 px-3 text-small")}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
