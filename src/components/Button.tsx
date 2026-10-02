import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./cx";

type Variant = "primary" | "quiet" | "ghost";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-3 rounded-btn px-5 text-body font-medium whitespace-nowrap transition-[transform,background-color,color,border-color] duration-150 ease-out select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-ink-2",
  quiet: "border border-line-2 bg-surface text-ink hover:border-control hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
};

/** Classes for anything that should look like a button (links stay links). */
export function buttonClasses(variant: Variant = "primary", extra?: string) {
  return cx(BASE, VARIANTS[variant], extra);
}

export function Button({ variant = "primary", className, type = "button", ...rest }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={type} className={buttonClasses(variant, className)} {...rest} />;
}

/** Navigation that looks like a button. Never nest a link in a button. */
export function LinkButton({ variant = "primary", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClasses(variant, className)} {...rest} />;
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M0 6h16M11 1l5 5-5 5" />
    </svg>
  );
}
