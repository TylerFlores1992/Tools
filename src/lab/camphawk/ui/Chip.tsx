import type { ComponentPropsWithRef } from "react";
import { cx } from "@/components/cx";
import { HIT_AREA } from "./hit";

// Ported from campsite-finder src/components/ui/Chip.tsx (2026-10-06). A toggle, green when
// selected because a selected chip widens what counts as available. aria-pressed for toggles;
// RadioChips passes role="radio" and the chip carries aria-checked instead.
// Lab change: disabled chips use the faint text token, not partial opacity (this repo's guard).
export interface ChipProps extends Omit<ComponentPropsWithRef<"button">, "aria-pressed" | "aria-checked"> {
  selected?: boolean;
  size?: "sm" | "md";
}

export function Chip({ selected = false, size = "md", className, type = "button", role, ...rest }: ChipProps) {
  const radio = role === "radio";
  return (
    <button
      type={type}
      role={role}
      aria-pressed={radio ? undefined : selected}
      aria-checked={radio ? selected : undefined}
      className={cx(
        "inline-flex items-center rounded-ch-chip border font-ch-body cursor-pointer transition-colors",
        HIT_AREA,
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green",
        "disabled:cursor-not-allowed disabled:text-ch-faint",
        "motion-reduce:transition-none",
        size === "sm" ? "px-[11px] py-[7px] text-[13px]" : "px-3 py-2 text-[14px]",
        selected
          ? "bg-ch-green-soft border-ch-green text-ch-green-deep font-bold"
          : "bg-ch-card border-ch-line text-ch-ink-2 font-semibold hover:border-ch-muted",
        className,
      )}
      {...rest}
    />
  );
}
