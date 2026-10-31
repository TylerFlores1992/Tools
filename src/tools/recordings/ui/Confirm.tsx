import type { ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import { cx } from "@/components/cx";

/**
 * A button that opens a short "are you sure?" panel before a destructive action. Plain
 * <details>, so it works without JavaScript; the panel holds the real form.
 */
export function Confirm({ label, children, className, danger = false }: { label: ReactNode; children: ReactNode; className?: string; danger?: boolean }) {
  return (
    <details className={cx("group", className)}>
      <summary className={cx(buttonClasses("ghost", "min-h-10 cursor-pointer list-none px-3 text-small [&::-webkit-details-marker]:hidden"), danger && "hover:text-wrong")}>
        {label}
      </summary>
      <div className="mt-2 grid gap-3 rounded-card border border-line-2 bg-surface-2 p-4 text-small text-ink-2">{children}</div>
    </details>
  );
}
