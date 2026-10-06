"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/components/cx";

// Ported from campsite-finder src/components/ui/Collapsible.tsx (2026-10-06): a disclosure that
// animates grid rows (no max-height clipping), with aria-expanded/aria-controls, and is `inert`
// while closed so a keyboard user can't tab into a hidden panel.
export function Collapsible({
  label, summary, children, defaultOpen = false, className,
}: { label: ReactNode; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const panelId = `${id}-panel`;
  const triggerId = `${id}-trigger`;
  return (
    <div className={className}>
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={cx(
          "flex min-h-12 w-full cursor-pointer items-center gap-2.5 border bg-ch-card px-3.5 py-3 text-left font-ch-body transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green motion-reduce:transition-none",
          open ? "rounded-t-ch-input border-ch-forest" : "rounded-ch-input border-ch-line hover:border-ch-muted",
        )}
      >
        <span className="flex-1 text-[15px] font-bold text-ch-ink">{label}</span>
        {summary ? <span className="text-[13px] font-semibold text-ch-muted">{summary}</span> : null}
        <ChevronDown aria-hidden="true" className={cx("size-4 shrink-0 text-ch-muted transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        inert={!open}
        className={cx(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] rounded-b-ch-input border border-t-0 border-ch-forest bg-ch-card" : "grid-rows-[0fr] border border-t-0 border-transparent",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pt-3 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
