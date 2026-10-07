import type { ComponentPropsWithRef } from "react";
import { cx } from "@/components/cx";
import { HIT_AREA } from "./hit";

// Ported from campsite-finder src/components/ui/Chip.tsx (2026-10-06). A toggle. aria-pressed for toggles;
// RadioChips passes role="radio" and the chip carries aria-checked instead.
// Lab changes: disabled chips use the faint text token, not partial opacity (this repo's guard);
// selected is forest with a tick, not green (CampHawk tints it green, but a filter isn't an open
// site), so it reads by shape as well as tone.
export interface ChipProps extends Omit<ComponentPropsWithRef<"button">, "aria-pressed" | "aria-checked"> {
  /** Leave unset for a plain action chip (a one-tap pick): no pressed or checked state at all. */
  selected?: boolean;
  size?: "sm" | "md";
}

export function Chip({ selected, size = "md", className, type = "button", role, children, ...rest }: ChipProps) {
  const radio = role === "radio";
  return (
    <button
      type={type}
      role={role}
      aria-pressed={radio ? undefined : selected}
      aria-checked={radio ? Boolean(selected) : undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-ch-chip border font-ch-body cursor-pointer transition-colors",
        HIT_AREA,
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green",
        "disabled:cursor-not-allowed disabled:text-ch-faint",
        "motion-reduce:transition-none",
        size === "sm" ? cx("py-[7px] text-[13px]", selected ? "pl-2 pr-[10px]" : "px-[11px]") : "px-3 py-2 text-[14px]",
        selected
          ? "gap-1.5 bg-ch-forest border-ch-forest text-ch-white font-bold"
          : "bg-ch-card border-ch-line text-ch-ink-2 font-semibold hover:border-ch-muted",
        className,
      )}
      {...rest}
    >
      {selected && (
        <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0"><path d="M2.2 6.3 4.8 8.8 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
      {children}
    </button>
  );
}
