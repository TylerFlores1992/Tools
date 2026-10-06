import type { HTMLAttributes } from "react";
import { cx } from "@/components/cx";

// Ported from campsite-finder src/components/ui/Tag.tsx (2026-10-06), so lab screens say status
// the way CampHawk does: a word, a shape and a screen-reader prefix, never colour alone.
//   open   a site is available right now (green, the only good-news tag)
//   watch  you asked for this; we're checking (ochre)
//   cart   Recreation.gov hand-off (blue)
//   paused not running; neutral, never red
//   alert  the user must act (red)
//   src    which provider you'll check out on; neutral, sentence case
// Lab change: `text-white` is `text-ch-white` (stock colours are deleted in this repo).
export type TagKind = "open" | "watch" | "cart" | "paused" | "alert" | "src";

const KIND: Record<TagKind, string> = {
  open: "bg-ch-green text-ch-white uppercase tracking-[.09em] font-bold",
  watch: "bg-ch-ochre-soft text-ch-ochre-ink uppercase tracking-[.09em] font-bold",
  cart: "bg-ch-blue text-ch-white uppercase tracking-[.09em] font-bold",
  paused: "bg-ch-shell text-ch-ink-2 uppercase tracking-[.09em] font-bold",
  alert: "bg-ch-alert text-ch-white uppercase tracking-[.09em] font-bold",
  src: "bg-ch-shell text-ch-ink-2 tracking-[.04em] font-semibold",
};

const DEFAULT_SR_PREFIX: Record<TagKind, string | null> = {
  open: "Status:", watch: "Status:", cart: "Status:", paused: "Status:",
  alert: "Needs attention:", src: "Booking provider:",
};

export function Tag({ kind, srPrefix, className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { kind: TagKind; srPrefix?: string | null }) {
  const prefix = srPrefix === undefined ? DEFAULT_SR_PREFIX[kind] : srPrefix;
  return (
    <span className={cx("inline-block rounded-ch-tag px-2 py-1 font-ch-body text-[10px] leading-none", KIND[kind], className)} {...rest}>
      {prefix ? <span className="sr-only">{prefix} </span> : null}
      {children}
    </span>
  );
}
