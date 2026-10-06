import type { HTMLAttributes } from "react";
import { CircleDashed, CirclePlus, Clock, CloudOff, Eye, Pause, Power, PowerOff, RefreshCw, ShoppingCart, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
import { cx } from "@/components/cx";

// Ported from campsite-finder src/components/ui/Tag.tsx (2026-10-06), so lab screens say status
// the way CampHawk does: a word, a shape and a screen-reader prefix, never colour alone.
//   open   a site is available right now (green, the only good-news tag)
//   watch  you asked for this; we're checking (ochre)
//   cart   Recreation.gov hand-off (blue)
//   paused not running; neutral, never red
//   alert  the user must act (red)
//   src    which provider you'll check out on; neutral, sentence case
// Lab changes: `text-white` is `text-ch-white` (stock colours are deleted in this repo). And every
// status carries a MARK, a small shape of its own (2026-10-06 fix round, for the owner's red-green
// colour blindness: CampHawk's tags differed by hue alone). The marks match Explore's map pins:
// a tick for open, a solid dot for booked, a ring for "couldn't check", a small dot for first
// come; the rest are line icons at one size and weight.
export type TagKind = "open" | "watch" | "cart" | "paused" | "alert" | "src";

export type Mark =
  | "open" | "booked" | "unknown" | "first-come"
  | "watching" | "queued" | "offered" | "in-cart" | "auto-cart"
  | "paused" | "reconnecting" | "needs-you" | "provider-down"
  | "on" | "off" | "not-set-up";

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

const DEFAULT_MARK: Record<TagKind, Mark | null> = {
  open: "open", watch: "watching", cart: "in-cart", paused: "paused", alert: "needs-you", src: null,
};

const ICONS: Partial<Record<Mark, LucideIcon>> = {
  watching: Eye, queued: Clock, offered: CirclePlus, "in-cart": ShoppingCart, "auto-cart": Zap, paused: Pause,
  reconnecting: RefreshCw, "needs-you": TriangleAlert, "provider-down": CloudOff,
  on: Power, off: PowerOff, "not-set-up": CircleDashed,
};

/** A status shape, 11px, in the tag's own colour. Exported for status lines outside a tag. */
export function StatusMark({ mark, className }: { mark: Mark; className?: string }) {
  const box = cx("inline-block size-[11px] shrink-0", className);
  // The four availability marks are drawn, so they match the map pins exactly.
  if (mark === "open") {
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true" className={box}>
        <path d="M2.2 6.3 4.8 8.8 9.8 3.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mark === "booked") return <svg viewBox="0 0 12 12" aria-hidden="true" className={box}><circle cx="6" cy="6" r="4.5" fill="currentColor" /></svg>;
  if (mark === "unknown") return <svg viewBox="0 0 12 12" aria-hidden="true" className={box}><circle cx="6" cy="6" r="3.9" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>;
  if (mark === "first-come") return <svg viewBox="0 0 12 12" aria-hidden="true" className={box}><circle cx="6" cy="6" r="2.4" fill="currentColor" /></svg>;
  const Icon = ICONS[mark]!;
  return <Icon aria-hidden="true" strokeWidth={2.75} className={box} />;
}

export function Tag({ kind, srPrefix, mark, className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { kind: TagKind; srPrefix?: string | null; mark?: Mark | null }) {
  const prefix = srPrefix === undefined ? DEFAULT_SR_PREFIX[kind] : srPrefix;
  const shape = mark === undefined ? DEFAULT_MARK[kind] : mark;
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-ch-tag px-2 py-1 font-ch-body text-[10px] leading-none", KIND[kind], className)} {...rest}>
      {shape && <StatusMark mark={shape} />}
      {prefix ? <span className="sr-only">{prefix} </span> : null}
      {children}
    </span>
  );
}
