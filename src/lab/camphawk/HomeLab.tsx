"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Search, ShoppingCart, Zap } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "./ui";
import { Backdrop } from "./Backdrop";
import { LookScene } from "./LookScene";
import { DEFAULT_LOOK, LOOKS, lookById, type LookId } from "./looks";
import { Nav } from "./Nav";
import { PricingSection } from "./Pricing";
import { CAMPGROUNDS_ROUNDED, COVERAGE_SENTENCE, VISITORS, type Visitor } from "./data";

// CampHawk's marketing home (campsite-finder src/app/(app)/page.tsx + (app)/layout.tsx),
// ported 2026-10-02 as the starting point for design experiments. Change freely here; port
// what works back to CampHawk by hand.

const FEATURES = [
  { icon: Clock, title: "Alerts in seconds", body: "We check watched campgrounds every 15 seconds, around the clock. When someone cancels, you hear about it before the site is back in circulation — not the next morning." },
  { icon: ShoppingCart, title: "Auto-cart on Recreation.gov", body: "We can put the opening straight into your cart, so it's held while you get to your phone. You just check out." },
  { icon: MapPin, title: "Live search — free, no account", body: `Real-time availability at ${CAMPGROUNDS_ROUNDED} campgrounds, on a map, with filters for tents, RVs, hookups and pad length. No subscription, no sign-up.` },
  { icon: Zap, title: "Flexible dates find more", body: "Say how many nights you need and a window to look in. Any three nights next month gives us far more chances to catch a cancellation than one fixed weekend." },
];

const STEPS = [
  ["Find the campground", "Search by place and dates. If sites are open you'll see them right there — that part's free."],
  ["Watch it if it's full", "One tap. Pick exact dates, or any N nights inside a window you're free."],
  ["Get the site", "Text, email and push the moment it opens — and on Recreation.gov it can already be in your cart."],
] as const;

const LIMITS = [
  "We never book or pay for anything. Checkout is always yours, on the provider's site.",
  "We can't create availability — if nobody cancels, there's nothing to find.",
  "We can't cancel or change a reservation you already have.",
];

/** The lab's own strip, above CampHawk's chrome: what this is, and who we're pretending to be. */
function LabBar({ visitor, onVisitor, look, onLook }: { visitor: Visitor; onVisitor: (v: Visitor) => void; look: LookId; onLook: (l: LookId) => void }) {
  return (
    <div className="bg-ch-forest text-ch-white">
      <div className="mx-auto flex max-w-[var(--ch-max)] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 text-ch-meta">
        <nav aria-label="Breadcrumb" className="flex items-center gap-x-2">
          <Link href="/private" className="flex min-h-11 items-center gap-1.5 underline-offset-2 hover:underline">
            <span aria-hidden="true">←</span> Private
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-bold">CampHawk lab</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Home</span>
        </nav>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <label htmlFor="lab-look" className="font-bold">Look</label>
          <select
            id="lab-look"
            value={look}
            onChange={(e) => onLook(e.target.value as LookId)}
            className="min-h-10 min-w-0 flex-1 cursor-pointer rounded-ch-chip border border-ch-white/40 bg-ch-forest px-3 font-bold text-ch-white sm:flex-none"
          >
            {LOOKS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <Link href="/private/camphawk/looks" className="flex min-h-11 items-center whitespace-nowrap underline underline-offset-2">All looks</Link>
        </div>
        <div role="radiogroup" aria-label="Pretend to be" className="flex w-full items-center justify-between gap-1 rounded-ch-chip bg-ch-white/10 p-0.5 sm:w-auto">
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

export function HomeLab({ initialLook = DEFAULT_LOOK }: { initialLook?: LookId }) {
  const [visitor, setVisitor] = useState<Visitor>("signed-out");
  const [lookId, setLookId] = useState<LookId>(initialLook);
  const look = lookById(lookId);
  // The look lives in the URL (?look=…) so a mockup can be linked and survives a reload.
  const chooseLook = (id: LookId) => {
    setLookId(id);
    const url = new URL(window.location.href);
    if (id === DEFAULT_LOOK) url.searchParams.delete("look");
    else url.searchParams.set("look", id);
    window.history.replaceState(null, "", url);
  };
  return (
    <div className="look" data-look={look.id}>
      <LabBar visitor={visitor} onVisitor={setVisitor} look={look.id} onLook={chooseLook} />
      <Backdrop visitor={visitor} look={look} />
      <Nav visitor={visitor} />
      <main id="main">
        <div className="look-top">
          <section className="look-hero mx-auto max-w-[var(--ch-max)] px-5 pb-6 pt-10 sm:pt-16">
            <h1 className="max-w-[16ch] text-balance font-ch-display text-[clamp(30px,5vw,44px)] font-extrabold leading-[1.03] tracking-[-.035em] text-ch-ink">
              The campsite you wanted is already booked. We wait for it.
            </h1>
            <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-ch-ink-2">
              {`CampHawk watches booked campgrounds around the clock and tells you the second someone cancels — usually within seconds. Live search across ${CAMPGROUNDS_ROUNDED} campgrounds is always free.`}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#" className={buttonClasses({ size: "lg", className: "px-6" })}>Search campgrounds free</a>
              <a href="#" className={buttonClasses({ variant: "quiet", size: "lg", className: "px-6" })}>See what a watch does</a>
            </div>
            <p className="mt-4 text-ch-fine text-ch-muted">{COVERAGE_SENTENCE}</p>
          </section>
          <LookScene look={look} />
        </div>

        <section className="look-features mx-auto max-w-[var(--ch-max)] px-5 py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="look-card rounded-ch-card border border-ch-line bg-ch-card p-4 shadow-ch-card">
                <span className="grid size-9 place-items-center rounded-full bg-ch-green-soft text-ch-green-deep">
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>
                <h2 className="mt-2.5 font-ch-display text-ch-h font-bold">{title}</h2>
                <p className="mt-1 text-ch-body leading-relaxed text-ch-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[var(--ch-max)] px-5 py-6">
          <h2 className="font-ch-display text-ch-title font-extrabold tracking-[-.03em]">How it works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {STEPS.map(([t, body], i) => (
              <li key={t} className="look-card rounded-ch-card border border-ch-line bg-ch-card p-4">
                <span className="grid size-6 place-items-center rounded-full bg-ch-green-soft text-[12px] font-extrabold text-ch-green-deep">{i + 1}</span>
                <p className="mt-2 text-ch-body font-bold">{t}</p>
                <p className="mt-1 text-ch-fine leading-normal text-ch-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="mx-auto max-w-[var(--ch-max)] scroll-mt-24 px-5 py-6">
          <PricingSection visitor={visitor} />
        </section>

        <section className="mx-auto max-w-[var(--ch-max)] px-5 py-6">
          <div className="look-card rounded-ch-card border border-ch-line bg-ch-card p-4">
            <h2 className="font-ch-display text-ch-h font-bold">What we don&apos;t do</h2>
            <ul className="mt-2 max-w-[62ch]">
              {LIMITS.map((line) => (
                <li key={line} className="flex gap-2 border-b border-ch-line py-2 text-ch-body leading-normal text-ch-ink-2 last:border-b-0">
                  <span aria-hidden="true" className="text-ch-muted">—</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[var(--ch-max)] px-5 pb-10 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <a href="#" className={buttonClasses({ size: "lg", className: "px-6" })}>
              <Search aria-hidden="true" className="size-4" />
              Find a campsite
            </a>
            <a href="#" className="text-ch-body font-bold text-ch-green hover:text-ch-green-deep">Or browse campgrounds by state</a>
          </div>
        </section>
      </main>
      <footer className="border-t border-ch-line bg-ch-shell">
        <div className="mx-auto flex max-w-[var(--ch-max)] flex-wrap items-center justify-between gap-3 px-5 py-6 text-ch-meta text-ch-muted">
          <span>© 2026 CampHawk</span>
          <nav aria-label="Footer" className="flex gap-4">
            {["Support", "Data sources", "Terms", "Privacy"].map((l) => <a key={l} href="#" className="hover:text-ch-ink">{l}</a>)}
          </nav>
        </div>
      </footer>
    </div>
  );
}
