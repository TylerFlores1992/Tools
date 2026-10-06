"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/components/cx";
import { VISITORS, type Visitor } from "./data";

/**
 * The lab's own strip, above CampHawk's chrome: where you are, who we're pretending to be, and
 * any page-specific controls (`children`, e.g. the Look menu).
 */
export function LabBar({ page, visitor, onVisitor, children }: { page: string; visitor: Visitor; onVisitor: (v: Visitor) => void; children?: ReactNode }) {
  return (
    <div className="bg-ch-forest text-ch-white">
      <div className="mx-auto flex max-w-[var(--ch-max)] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 text-ch-meta">
        <nav aria-label="Breadcrumb" className="flex items-center gap-x-2">
          <Link href="/private" className="flex min-h-11 items-center gap-1.5 underline-offset-2 hover:underline">
            <span aria-hidden="true">←</span> Private
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/private/camphawk" className="flex min-h-11 items-center font-bold underline-offset-2 hover:underline">CampHawk lab</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{page}</span>
        </nav>
        {children && <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">{children}</div>}
        <div role="radiogroup" aria-label="Pretend to be" className="flex w-full flex-wrap items-center justify-between gap-1 rounded-[22px] bg-ch-white/10 p-0.5 sm:w-auto sm:rounded-ch-chip">
          <span className="hidden px-2 sm:inline">View as</span>
          {VISITORS.map((v) => {
            const on = v.value === visitor;
            return (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onVisitor(v.value)}
                className={cx("flex min-h-10 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-ch-chip px-3 font-bold sm:flex-none", on ? "bg-ch-white text-ch-forest" : "text-ch-white hover:bg-ch-white/15")}
              >
                {on && <span aria-hidden="true">✓</span>}
                {v.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Links between the round-2 directions and the current home, for the lab bar. */
export function DirectionLinks({ current }: { current: "golden-hour" | "trail-poster" }) {
  const links = [
    ["/private/camphawk", "Current"],
    ["/private/camphawk/golden-hour", "A: Golden hour"],
    ["/private/camphawk/trail-poster", "B: Trail poster"],
  ] as const;
  return (
    <nav aria-label="Directions" className="flex items-center gap-1">
      {links.map(([href, label]) => {
        const on = href.endsWith(current);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cx("flex min-h-11 items-center whitespace-nowrap rounded-ch-chip px-3 font-bold", on ? "bg-ch-white/15 underline underline-offset-4" : "underline-offset-2 hover:underline")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
