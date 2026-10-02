import type { ReactNode } from "react";
import { cx } from "./cx";

/** The small mono uppercase eyebrow used above titles and on metadata. */
export function Label({ children, className, rule = false }: { children: ReactNode; className?: string; rule?: boolean }) {
  return (
    <p className={cx("flex items-center gap-3 font-mono text-label uppercase text-ink-2", className)}>
      {rule && <span aria-hidden="true" className="h-px w-7 bg-ink-2" />}
      {children}
    </p>
  );
}
