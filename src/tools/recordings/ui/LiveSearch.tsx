"use client";

import { createContext, useContext, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/cx";
import { Spinner } from "@/components/Spinner";

/**
 * A GET form that loads its new results in place and says so while it waits: "Searching…" shows
 * and the old results stop taking taps, instead of the page sitting still for the seconds the DVR takes.
 * `LiveArea` holds the pending state; `LiveForm` and `LiveResults` inside it share it. Without
 * JavaScript the form submits as a normal GET.
 */
type Live = { pending: boolean; go: (url: string) => void };
const LiveContext = createContext<Live>({ pending: false, go: () => {} });

export function LiveArea({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (url: string) => start(() => router.replace(url, { scroll: false }));
  return <LiveContext.Provider value={{ pending, go }}>{children}</LiveContext.Provider>;
}

export function LiveForm({ action, children, className, role }: { action: string; children: ReactNode; className?: string; role?: string }) {
  const { go } = useContext(LiveContext);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget)) if (typeof v === "string") q.append(k, v);
    go(`${action}?${q}`);
  }
  return (
    <form action={action} method="get" onSubmit={onSubmit} className={className} role={role}>
      {children}
    </form>
  );
}

/**
 * Marks what's under it as out of date while new results load: busy for screen readers, and not
 * tappable, so an old result can't be opened by mistake. (Not dimmed: partial opacity breaks the
 * text contrast the tokens guarantee, src/design/opacity.test.mts. `LiveStatus` says "Searching…".)
 */
export function LiveResults({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useContext(LiveContext);
  return (
    <div aria-busy={pending || undefined} className={cx(pending && "pointer-events-none", className)}>
      {children}
    </div>
  );
}

/** "Searching…" while new results load; nothing otherwise. */
export function LiveStatus({ children = "Searching…", className }: { children?: ReactNode; className?: string }) {
  const { pending } = useContext(LiveContext);
  return (
    <p role="status" className={cx("flex min-h-6 items-center gap-2 text-small text-ink-2", className)}>
      {pending && (
        <>
          <Spinner />
          {children}
        </>
      )}
    </p>
  );
}
