"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import { cx } from "@/components/cx";
import { State } from "@/components/State";
import type { SenderResult } from "../rule-note";

/**
 * Morning Mail's sender buttons ("Always trash", "Not junk", …) answer in a toast at the bottom of
 * the screen, where you are, and the page refreshes in place. They used to redirect to the page
 * with the note in the address, and that navigation scrolled back to the top after every press.
 */
type Show = (r: SenderResult) => void;

const ToastContext = createContext<Show>(() => {});

export function MailToaster({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<SenderResult | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<Show>((r) => {
    if (!r.message) return;
    setToast(r);
    setShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), r.ok ? 6000 : 9000);
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
              "pointer-events-auto flex max-w-[560px] items-center gap-x-4 rounded-card border border-line-2 bg-surface-2 py-3 pl-5 pr-3 text-small shadow-card transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
              shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <State kind={toast.ok ? "ok" : "wrong"} className="min-w-0 flex-1">{toast.message}</State>
            <button type="button" onClick={() => setShown(false)} aria-label="Dismiss" className={buttonClasses("ghost", "min-h-11 shrink-0 px-3 text-small")}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * The form around one sender button. The result goes to the toast from the action itself: the row
 * holding this form may disappear when the page refreshes (the sender is now covered by a rule),
 * and the toaster never unmounts. `useFormStatus` still sees the form as pending, so the button
 * inside says it is working.
 */
export function SenderForm({ action, children }: { action: (form: FormData) => Promise<SenderResult>; children: ReactNode }) {
  const toast = useContext(ToastContext);
  return (
    <form
      action={async (fd) => {
        toast(await action(fd));
      }}
    >
      {children}
    </form>
  );
}
