"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { buttonClasses } from "./ui";
import { Backdrop } from "./Backdrop";
import { LookScene } from "./LookScene";
import { DEFAULT_LOOK, LOOKS, lookById, type LookId } from "./looks";
import { Nav } from "./Nav";
import { PricingSection } from "./Pricing";
import { COVERAGE_SENTENCE, type Visitor } from "./data";
import { FEATURES, FOOTER_LINKS, HEADLINE, INTRO, LIMITS, STEPS } from "./copy";
import { LabBar } from "./LabBar";

// CampHawk's marketing home (campsite-finder src/app/(app)/page.tsx + (app)/layout.tsx),
// ported 2026-10-02 as the starting point for design experiments. Change freely here; port
// what works back to CampHawk by hand.

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
      <LabBar page="Home" visitor={visitor} onVisitor={setVisitor}>
        <label htmlFor="lab-look" className="font-bold">Look</label>
        <select
          id="lab-look"
          value={look.id}
          onChange={(e) => chooseLook(e.target.value as LookId)}
          className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-ch-chip border border-ch-white/40 bg-ch-forest px-3 font-bold text-ch-white sm:flex-none"
        >
          {LOOKS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <Link href="/private/camphawk/looks" className="flex min-h-11 items-center whitespace-nowrap underline underline-offset-2">All looks</Link>
        <Link href="/private/camphawk/golden-hour" className="flex min-h-11 items-center whitespace-nowrap underline underline-offset-2">Round 2</Link>
      </LabBar>
      <Backdrop visitor={visitor} look={look} />
      <Nav visitor={visitor} />
      <main id="main">
        <div className="look-top">
          <section className="look-hero mx-auto max-w-[var(--ch-max)] px-5 pb-6 pt-10 sm:pt-16">
            <h1 className="max-w-[16ch] text-balance font-ch-display text-[clamp(30px,5vw,44px)] font-extrabold leading-[1.03] tracking-[-.035em] text-ch-ink">
              {HEADLINE}
            </h1>
            <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-ch-ink-2">
              {INTRO}
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
            {FOOTER_LINKS.map((l) => <a key={l} href="#" className="hover:text-ch-ink">{l}</a>)}
          </nav>
        </div>
      </footer>
    </div>
  );
}
