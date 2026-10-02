import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * A status, always as icon + word + colour, never colour alone (the owner is red-green
 * colour-blind). `sr` gives screen readers the state name before the text.
 */
type Kind = "ok" | "wrong" | "note";

const STYLE: Record<Kind, { cls: string; sr: string; icon: ReactNode }> = {
  ok: {
    cls: "text-ice",
    sr: "Correct:",
    icon: <path d="M3 8.5l3.2 3L13 4.5" />,
  },
  wrong: {
    cls: "text-wrong",
    sr: "Problem:",
    icon: <path d="M4 4l8 8M12 4l-8 8" />,
  },
  note: {
    cls: "text-ink-2",
    sr: "Note:",
    icon: (
      <>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 7v4M8 4.6v.4" />
      </>
    ),
  },
};

export function State({ kind, children, className }: { kind: Kind; children: ReactNode; className?: string }) {
  const s = STYLE[kind];
  return (
    <span className={cx("inline-flex items-start gap-2", s.cls, className)}>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-[0.2em] shrink-0">
        {s.icon}
      </svg>
      <span>
        <span className="sr-only">{s.sr} </span>
        {children}
      </span>
    </span>
  );
}
