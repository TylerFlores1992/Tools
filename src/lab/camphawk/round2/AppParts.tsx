"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Heart } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses, type ButtonVariant } from "../ui";
import { HIT_AREA, HIT_BOX } from "../ui/hit";
import { priceShort, type Visitor } from "../data";
import { accountGate, canWatch, ROUTES, watchCtaLabel } from "./gates";
import { PhotoHeader, type Tab } from "./GhChrome";
import { Art, type Piece } from "./Art";
import { withVisitor } from "./labState";

// Pieces the Golden hour app screens (Explore, New watch, Watches) share, ported from
// campsite-finder src/components/v2 (WatchCta, SubscribeCta, PricingLink, FavoriteHeart,
// SetupNudges) and driven by the lab's switches. Lab links that would leave the lab (sign-up,
// checkout, settings) go nowhere ("#").
// Lab changes, from CampHawk's own colour rules: a favorite is ochre ("you asked for this"), not
// red; the upgrade note is a plain card, not decorative green.

/** Subscribers pick a plan in the lab: Auto-Cart, or Alerts (the base plan). */
export type Plan = "autocart" | "alerts";
export const PLANS: readonly Plan[] = ["autocart", "alerts"];

/** WatchCta: one control, a label per visitor, never a price. A subscriber goes to New watch
    with whatever is known filled in. */
export function WatchCtaLink({
  visitor, label = "Start a watch", campgroundId, start, end, variant = "primary", fullWidth = true, className,
}: { visitor: Visitor; label?: string; campgroundId?: string; start?: string | null; end?: string | null; variant?: ButtonVariant; fullWidth?: boolean; className?: string }) {
  const q = new URLSearchParams({ ...(campgroundId ? { campground: campgroundId } : {}), ...(start && end ? { start, end } : {}) }).toString();
  const href = canWatch(visitor) ? withVisitor(`${ROUTES.newWatch}${q ? `?${q}` : ""}`, visitor) : "#";
  return <Link href={href} className={buttonClasses({ variant, fullWidth, className })}>{watchCtaLabel(visitor, label)}</Link>;
}

/** SubscribeCta: what someone who can't watch yet can do next. Nothing for a subscriber. */
export function SubscribeCta({ visitor, fullWidth = false, className }: { visitor: Visitor; fullWidth?: boolean; className?: string }) {
  const gate = accountGate(visitor);
  if (gate === "ready") return null;
  const row = cx(fullWidth ? "grid gap-2" : "flex flex-wrap items-center gap-2", className);
  const btn = (variant: ButtonVariant = "primary") => buttonClasses({ variant, fullWidth, className: fullWidth ? undefined : "px-5" });
  // The app sells through the store's own paywall: no price, no account needed.
  if (gate === "appGuest") return <div className={row}><a href="#" className={btn()}>See plans</a></div>;
  return (
    <div className={row}>
      <a href="#" className={btn()}>{visitor === "lapsed" ? "Resubscribe" : "Start free trial"}</a>
      <a href="#" className={btn("quiet")}>Plan options</a>
      {gate === "signedOut" && <a href="#" className={btn("quiet")}>Sign in</a>}
    </div>
  );
}

/** PricingLink: the one upgrade pitch, to a subscriber on the base plan, on the web only. */
export function PricingLink({ visitor, plan, className }: { visitor: Visitor; plan: Plan; className?: string }) {
  if (visitor !== "subscriber" || plan !== "alerts") return null;
  return (
    <div className={cx("rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card", className)}>
      <p className="text-[16px] font-bold text-ch-ink">Alerts race you to the site. Auto-Cart wins the race for you.</p>
      <p className="mt-1 max-w-[58ch] text-[15px] leading-relaxed text-ch-ink-2">
        Add Auto-Cart and an opening goes straight into your Recreation.gov cart — held while you get to your phone. {priceShort("autocart", "monthly")} or {priceShort("autocart", "yearly")}, prorated on your current billing.
      </p>
      <a href="#" className={buttonClasses({ size: "sm", className: "mt-3 min-h-11 px-4" })}>Upgrade to Auto-Cart</a>
    </div>
  );
}

/** SetupNudges' first nudge: a subscriber with live watches and no phone number. Ochre is "you
    asked for this" (your alerting), not an error. */
export function PhoneNudge({ className }: { className?: string }) {
  return (
    <div className={cx("rounded-[13px] border border-ch-ochre-line bg-ch-ochre-soft px-4 py-3.5", className)}>
      <p className="text-[16px] font-bold text-ch-ink">You&apos;re only getting email alerts</p>
      <p className="mt-1 text-[15px] leading-relaxed text-ch-ink-2">Openings often last minutes. A text is what actually reaches you in time — add your number and we&apos;ll send both.</p>
      <a href="#" className="mt-1.5 inline-flex min-h-11 items-center text-[16px] font-bold text-ch-green underline-offset-2 hover:text-ch-green-deep hover:underline">Turn on text alerts</a>
    </div>
  );
}

/** An absolutely placed heart takes the tap box alone: `relative` would undo its `absolute`. */
export function FavoriteHeart({ favorite, onToggle, name, className }: { favorite: boolean; onToggle: () => void; name: string; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      title={favorite ? "Favorited" : "Add to favorites"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className={cx(/\b(absolute|fixed|sticky)\b/.test(className ?? "") ? HIT_BOX : HIT_AREA, "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-ch-green-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ch-green motion-reduce:transition-none", className)}
    >
      <Heart aria-hidden="true" className={favorite ? "size-[18px] text-ch-ochre-ink" : "size-[18px] text-ch-muted"} fill={favorite ? "currentColor" : "none"} />
    </button>
  );
}

/** A band's photo and its scrim. `pos`/`posLg` keep the photo's one warm light in view when the
    band crops it (phones, then 1024px and up). */
export function BandPhoto({ art, alt = "", pos, posLg }: { art: Piece; alt?: string; pos: string; posLg: string }) {
  return (
    <>
      <Art art={art} eager alt={alt} sizes="(max-width: 1023px) 1440px, 100vw" className="gh-app-photo" style={{ "--gh-pos": pos, "--gh-pos-lg": posLg } as CSSProperties} />
      <div aria-hidden="true" className="gh-app-scrim absolute inset-0" />
    </>
  );
}

/** The forest band an app screen opens with: the header, then the screen's title in paper
    type. `dock` is how far the first card below rises into it. */
export function AppBand({ visitor, current, title, sub, children, photo, dock = true }: { visitor: Visitor; current?: Tab; title: string; sub?: ReactNode; children?: ReactNode; photo?: ReactNode; dock?: boolean }) {
  return (
    <section className="relative isolate overflow-hidden bg-ch-forest">
      {photo}
      <PhotoHeader visitor={visitor} current={current} />
      {/* A photo band with only a title gets more room on wide screens, so the picture reads as
          a place, not a strip; the title sits low, near the card it introduces. */}
      <div className={cx("relative mx-auto max-w-[var(--gh-max)] px-5 pt-6 sm:px-8 sm:pt-10", dock ? "pb-[calc(var(--gh-dock)+28px)]" : "pb-[clamp(40px,5vw,72px)]", Boolean(photo) && !sub && "lg:pt-[clamp(72px,7vw,128px)]")}>
        <h1 className="max-w-[18ch] text-balance font-ch-display text-[clamp(34px,4.4vw,56px)] font-extrabold leading-[1.02] tracking-[-.03em] text-ch-paper">{title}</h1>
        {sub && <div className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ch-line">{sub}</div>}
        {children}
      </div>
    </section>
  );
}

/** Lab switch styling shared by the screens' lab bars. */
export const labSelect = "min-h-11 cursor-pointer rounded-ch-chip border border-ch-white/40 bg-ch-forest px-3 font-bold text-ch-white";

export function LabSelect<T extends string>({ label, short, value, options, onChange }: { label: string; short: string; value: T; options: ReadonlyArray<readonly [T, string]>; onChange: (v: T) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span aria-hidden="true" className="font-bold">{short}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className={labSelect}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
