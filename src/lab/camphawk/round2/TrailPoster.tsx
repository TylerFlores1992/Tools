"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { buttonClasses } from "../ui";
import { COVERAGE_SENTENCE, type Visitor } from "../data";
import { FEATURES, FOOTER_LINKS, HEADLINE, INTRO, LIMITS, STEPS } from "../copy";
import { DirectionLinks, LabBar } from "../LabBar";
import { Nav } from "../Nav";
import { PricingSection } from "../Pricing";
import { Art, ART } from "./Art";

// Round 2, direction B "Trail poster" (docs/design/camphawk-home.md): CampHawk as a park poster
// you'd want on the wall, extending the painted hawk CampHawk already owns. The headline sits in
// the poster's sky (the sky is the page's own paper); painted vignettes replace icon cards.

const VIGNETTES = [ART.b3, ART.b4, ART.b5, ART.b6] as const;

export function TrailPoster() {
  const [visitor, setVisitor] = useState<Visitor>("signed-out");
  return (
    <div className="tp look-grain bg-ch-paper">
      <LabBar page="Round 2" visitor={visitor} onVisitor={setVisitor}>
        <DirectionLinks current="trail-poster" />
      </LabBar>
      <Nav visitor={visitor} />
      <main id="main">
        <section className="mx-auto grid max-w-[var(--tp-max)] items-center gap-x-16 gap-y-10 px-5 pb-6 pt-[clamp(32px,5vw,72px)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h1 className="max-w-[14ch] text-balance font-ch-display text-[clamp(44px,5.6vw,88px)] font-black leading-[.96] tracking-[-.035em] text-ch-forest">
              {HEADLINE}
            </h1>
            <p className="mt-7 max-w-[50ch] text-[17px] leading-relaxed text-ch-ink-2 sm:text-[18px]">{INTRO}</p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <a href="#" className={buttonClasses({ size: "lg", className: "px-6" })}>
                <Search aria-hidden="true" className="size-4" />
                Search campgrounds free
              </a>
              <a href="#watch" className={buttonClasses({ variant: "quiet", size: "lg", className: "px-6" })}>See what a watch does</a>
            </div>
          </div>
          {/* The signature: the poster, hung like a print. */}
          <figure className="tp-print mx-auto w-full max-w-[440px] lg:w-[min(34vw,460px)] lg:max-w-none">
            <Art art={ART.b2} eager sizes="(min-width: 1024px) 460px, 92vw" className="block h-auto w-full" />
          </figure>
        </section>

        <p className="mx-auto max-w-[var(--tp-max)] px-5 pt-6 text-[13.5px] leading-relaxed text-ch-muted sm:px-8">{COVERAGE_SENTENCE}</p>

        <section id="watch" className="scroll-mt-28 mx-auto max-w-[var(--tp-max)] px-5 pb-[clamp(48px,8vw,104px)] pt-[clamp(56px,9vw,120px)] sm:px-8">
          <h2 className="font-ch-display text-[clamp(34px,4.4vw,60px)] font-black leading-[1] tracking-[-.04em] text-ch-forest">What a watch does</h2>
          <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ title, body }, i) => (
              <li key={title}>
                <Art art={VIGNETTES[i]} sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 80vw" className="tp-vignette aspect-square w-full max-w-[260px]" />
                <h3 className="mt-4 font-ch-display text-[21px] font-extrabold leading-tight tracking-[-.02em] text-ch-forest">{title}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-ch-ink-2">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y-2 border-ch-forest bg-ch-ochre-soft">
          <div className="mx-auto grid max-w-[var(--tp-max)] gap-10 px-5 py-[clamp(56px,8vw,104px)] sm:px-8 lg:grid-cols-[4fr_8fr]">
            <h2 className="font-ch-display text-[clamp(34px,4.4vw,60px)] font-black leading-[1] tracking-[-.04em] text-ch-forest">How it works</h2>
            <ol className="grid gap-px overflow-hidden rounded-ch-card border-2 border-ch-forest bg-ch-forest sm:grid-cols-3">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="bg-ch-paper p-6">
                  <span className="font-ch-display text-[64px] font-black leading-none tracking-[-.04em] text-ch-ochre-ink">{i + 1}</span>
                  <p className="mt-3 font-ch-display text-[20px] font-extrabold leading-tight text-ch-forest">{title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-ch-ink-2">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-28 mx-auto max-w-[var(--tp-max)] px-5 py-[clamp(56px,8vw,104px)] sm:px-8">
          <PricingSection visitor={visitor} bare />
        </section>

        <section className="mx-auto max-w-[var(--tp-max)] px-5 pb-[clamp(56px,8vw,104px)] sm:px-8">
          <h2 className="font-ch-display text-[22px] font-extrabold tracking-[-.02em] text-ch-forest">What we don&apos;t do</h2>
          <ul className="mt-3 max-w-[64ch] border-t-2 border-ch-forest">
            {LIMITS.map((line) => (
              <li key={line} className="border-b border-ch-line py-3.5 text-[16px] leading-relaxed text-ch-ink-2">{line}</li>
            ))}
          </ul>
        </section>

        <section className="tp-band relative isolate overflow-hidden">
          <Art art={ART.b1} sizes="100vw" className="tp-band-art" />
          <div className="absolute inset-x-0 top-0 mx-auto max-w-[var(--tp-max)] px-5 pt-[clamp(32px,5vw,72px)] sm:px-8">
            <h2 className="max-w-[12ch] font-ch-display text-[clamp(34px,4.4vw,64px)] font-black leading-[1] tracking-[-.04em] text-ch-forest">Start with a search. It&apos;s free.</h2>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#" className={buttonClasses({ size: "lg", className: "px-6" })}>
                <Search aria-hidden="true" className="size-4" />
                Find a campsite
              </a>
              <a href="#" className={buttonClasses({ variant: "quiet", size: "lg", className: "px-6" })}>Or browse campgrounds by state</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-ch-line bg-ch-shell">
        <div className="mx-auto flex max-w-[var(--tp-max)] flex-wrap items-center justify-between gap-3 px-5 py-6 text-ch-meta text-ch-muted sm:px-8">
          <span>© 2026 CampHawk</span>
          <nav aria-label="Footer" className="flex gap-1">
            {FOOTER_LINKS.map((l) => <a key={l} href="#" className="flex min-h-11 items-center px-2 hover:text-ch-ink hover:underline">{l}</a>)}
          </nav>
        </div>
      </footer>
    </div>
  );
}
