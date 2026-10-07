import { cx } from "@/components/cx";

// Ported from campsite-finder src/components/ui/Button.tsx (2026-10-02) so lab designs port
// back unchanged. Variants carry meaning: primary = gets you a site (green), quiet = neutral,
// cart = hand-off to Recreation.gov (blue), warn = the user must act (red).
// Lab additions (2026-10-06 fix round): ink = a firm action that doesn't get you a site (start a
// trial, sign up, save, finish), so green keeps its one meaning; paper = the same on the forest band.
export type ButtonVariant = "primary" | "quiet" | "cart" | "warn" | "ink" | "paper";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-ch-green text-ch-white shadow-[0_2px_0_var(--color-ch-green-deep)] " +
    "hover:bg-ch-green-hover active:translate-y-px active:shadow-[0_1px_0_var(--color-ch-green-deep)]",
  quiet: "bg-ch-card text-ch-ink-2 border border-ch-line hover:bg-ch-paper hover:border-ch-muted",
  cart:
    "bg-ch-blue text-ch-white shadow-[0_2px_0_var(--color-ch-blue-deep)] " +
    "hover:bg-ch-blue-hover active:translate-y-px active:shadow-[0_1px_0_var(--color-ch-blue-deep)]",
  warn:
    "bg-ch-alert text-ch-white shadow-[0_2px_0_var(--color-ch-alert-deep)] " +
    "hover:bg-ch-alert-hover active:translate-y-px active:shadow-[0_1px_0_var(--color-ch-alert-deep)]",
  ink:
    "bg-ch-forest text-ch-white shadow-[0_2px_0_var(--color-ch-ink)] " +
    "hover:bg-ch-ink active:translate-y-px active:shadow-[0_1px_0_var(--color-ch-ink)]",
  paper:
    "bg-ch-paper text-ch-forest shadow-[0_2px_0_var(--color-ch-faint)] " +
    "hover:bg-ch-white active:translate-y-px active:shadow-[0_1px_0_var(--color-ch-faint)]",
};

const SIZE: Record<ButtonSize, string> = {
  // 14px, not the 12px meta size: a small button is still a control, and 12px in a 44px pill
  // read as a placeholder beside 15-17px body text (round-7 critique).
  sm: "px-3 py-2.5 text-[14px]",
  md: "px-3 py-3 text-[14.5px]",
  lg: "px-3 py-[19px] text-[17px]",
};

export function buttonClasses({ variant = "primary", size = "md", fullWidth = false, className }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-ch-btn font-ch-body font-bold",
    "cursor-pointer transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green",
    "motion-reduce:transition-none motion-reduce:active:translate-y-0",
    VARIANT[variant],
    SIZE[size],
    fullWidth && "w-full",
    className,
  );
}
