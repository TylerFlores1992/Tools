"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";
import { cx } from "./cx";

/**
 * Put inside a next/link <Link>: a small dot that pulses while Next is still fetching the page
 * the link was tapped for, so a slow navigation (a cold server, a link that isn't prefetched,
 * like Private) never looks like a dead tap. Same mark as AppTabs' pending dot.
 *
 * Always rendered at a fixed size and only its opacity changes, so it never moves the text. It
 * appears after 100 ms, so a fast navigation doesn't flash it. While pending it also sets
 * aria-busy on the link itself, which screen readers report.
 *
 * `overlay` takes it out of the text flow (the link needs `relative`), so the link's label and
 * size never change: "end" sits it in the right padding (button-shaped links), "below" centres it
 * under the label (nav pills and tabs, whose padding is too tight on a phone).
 */
export function LinkPending({ overlay, className }: { overlay?: "end" | "below"; className?: string }) {
  const { pending } = useLinkStatus();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const link = ref.current?.closest("a");
    if (!link) return;
    if (pending) link.setAttribute("aria-busy", "true");
    else link.removeAttribute("aria-busy");
    return () => link.removeAttribute("aria-busy");
  }, [pending]);
  const dot = (
    <span
      ref={overlay ? undefined : ref}
      aria-hidden="true"
      className={cx(
        "inline-block size-1.5 shrink-0 rounded-full bg-current transition-opacity duration-150",
        pending ? "animate-pulse opacity-100 delay-100 motion-reduce:animate-none" : "opacity-0",
        !overlay && className,
      )}
    />
  );
  if (!overlay) return dot;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cx("pointer-events-none absolute flex", overlay === "end" ? "inset-y-0 right-1.5 items-center" : "inset-x-0 bottom-0.5 justify-center", className)}
    >
      {dot}
    </span>
  );
}
