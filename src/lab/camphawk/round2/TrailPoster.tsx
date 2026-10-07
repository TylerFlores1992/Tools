"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { buttonClasses } from "../ui";
import { COVERAGE_SENTENCE, type Visitor } from "../data";
import { FEATURES, FOOTER_LINKS, HEADLINE, INTRO, LIMITS, STEPS } from "../copy";
import { DirectionLinks, LabBar } from "../LabBar";
import { Nav } from "../Nav";
import { Art, ART } from "./Art";
import { Pricing2 } from "./Pricing2";

// Round 2, direction B "Trail poster" (docs/design/camphawk-home.md): CampHawk as a park poster
// you'd want on the wall, extending the painted hawk CampHawk already owns. The poster hangs like
// a print beside the headline, with an alert pinned to it like a ticket stub (the product proof).
// Painted vignettes replace icon cards. Content sits on the header's grid (--ch-max).

/** The proof, pinned to the print: what an alert looks like. Labeled as an example. */
function TicketAlert() {
  return (
    <figure className="tp-ticket w-[260px] rounded-[12px] border-2 border-ch-forest bg-ch-card text-ch-ink">
      <div className="px-4 pb-3 pt-3.5">
        <p className="text-[13px] font-bold text-ch-ochre-ink">A site just opened, 14 sec ago</p>
        <p className="mt-1 font-ch-display text-[20px] font-extrabold leading-tight text-ch-forest">Upper Pines, Site 042</p>
        <p className="mt-0.5 text-[14px] text-ch-ink-2">Yosemite. Jul 18 to 21, 3 nights.</p>
      </div>
      <div className="flex items-center gap-1.5 border-t-2 border-dashed border-ch-forest px-4 py-2.5 text-[14px] font-bold text-ch-blue-deep">
        <Check aria-hidden="true" className="size-4 shrink-0" />
        In your Recreation.gov cart
      </div>
      <figcaption className="px-4 pb-2.5 text-[12px] text-ch-muted">Example alert</figcaption>
    </figure>
  );
}

function HeroSearch() {
  return (
    <form role="search" action="#" onSubmit={(e) => e.preventDefault()} className="mt-8 flex max-w-[560px] flex-col gap-2.5 sm:flex-row">
      <label className="flex-1">
        <span className="sr-only">Where do you want to camp?</span>
        <input type="text" name="where" placeholder="City, park, or ZIP…" autoComplete="off" className="min-h-14 w-full rounded-ch-input border-2 border-ch-forest bg-ch-card px-4 text-[16px] text-ch-ink placeholder:text-ch-muted" />
      </label>
      <button type="submit" className={buttonClasses({ size: "lg", className: "min-h-14 whitespace-nowrap px-6 py-0" })}>
        <Search aria-hidden="true" className="size-4.5" />
        Search campgrounds free
      </button>
    </form>
  );
}

const SMALL = [ART.b4, ART.b5, ART.b6] as const;

export function TrailPoster() {
  const [visitor, setVisitor] = useState<Visitor>("signed-out");
  const [lead, ...rest] = FEATURES;
  return (
    <div className="tp look-grain bg-ch-paper">
      <LabBar page="Round 2" visitor={visitor} onVisitor={setVisitor}>
        <DirectionLinks current="trail-poster" />
      </LabBar>
      <Nav visitor={visitor} plainPhone />
      <main id="main">
        <section className="mx-auto grid max-w-[var(--ch-max)] items-center gap-x-14 gap-y-12 px-5 pb-8 pt-[clamp(28px,5vw,64px)] lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h1 className="max-w-[14ch] text-balance font-ch-display text-[clamp(42px,5.4vw,76px)] font-black leading-[.97] tracking-[-.035em] text-ch-forest">
              {HEADLINE}
            </h1>
            <p className="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-ch-ink-2 sm:text-[18px]">{INTRO}</p>
            <HeroSearch />
            <a href="#watch" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[16px] font-bold text-ch-forest underline decoration-ch-ochre decoration-2 underline-offset-[6px] hover:decoration-ch-forest">
              See what a watch does <span aria-hidden="true">↓</span>
            </a>
          </div>
          {/* The signature: the poster hung like a print, an alert pinned to it. */}
          <div className="relative mx-auto w-full max-w-[400px] pb-12 lg:w-[min(34vw,420px)] lg:max-w-none">
            <figure className="tp-print">
              <Art art={ART.b2} eager sizes="(min-width: 1024px) 420px, 400px" className="block h-auto w-full" />
            </figure>
            <div className="absolute -left-2 bottom-0 sm:-left-10 lg:bottom-6">
              <TicketAlert />
            </div>
          </div>
        </section>

        <p className="mx-auto max-w-[var(--ch-max)] px-5 text-[14px] leading-relaxed text-ch-muted"><span className="block max-w-[72ch]">{COVERAGE_SENTENCE}</span></p>

        <section id="watch" className="mx-auto max-w-[var(--ch-max)] scroll-mt-28 px-5 pb-[clamp(48px,8vw,104px)] pt-[clamp(64px,9vw,120px)]">
          <h2 className="font-ch-display text-[clamp(34px,4.4vw,60px)] font-black leading-[1] tracking-[-.04em] text-ch-forest">What a watch does</h2>
          <div className="mt-10 grid gap-x-14 gap-y-10 lg:grid-cols-[5fr_6fr]">
            <div>
              <Art art={ART.b3} sizes="(min-width: 1024px) 420px, 80vw" className="aspect-square w-full max-w-[420px]" />
              <h3 className="mt-4 font-ch-display text-[28px] font-extrabold leading-tight tracking-[-.025em] text-ch-forest">{lead.title}</h3>
              <p className="mt-2 max-w-[48ch] text-[17px] leading-relaxed text-ch-ink-2">{lead.body}</p>
            </div>
            <ul className="grid content-start gap-8 lg:pt-6">
              {rest.map(({ title, body }, i) => (
                <li key={title} className="grid grid-cols-[96px_1fr] items-start gap-5 sm:grid-cols-[136px_1fr]">
                  <Art art={SMALL[i]} sizes="136px" className="aspect-square w-full" />
                  <div>
                    <h3 className="font-ch-display text-[21px] font-extrabold leading-tight text-ch-forest">{title}</h3>
                    <p className="mt-1.5 text-[16px] leading-relaxed text-ch-ink-2">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[var(--ch-max)] px-5 pb-[clamp(56px,8vw,104px)]">
          <h2 className="font-ch-display text-[clamp(34px,4.4vw,60px)] font-black leading-[1] tracking-[-.04em] text-ch-forest">How it works</h2>
          {/* The steps as stops on a trail: a dashed line runs between the numbered markers. */}
          <ol className="tp-trail mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="relative">
                <span className="relative z-10 grid size-16 place-items-center rounded-full border-2 border-ch-forest bg-ch-paper font-ch-display text-[30px] font-black text-ch-forest">{i + 1}</span>
                <p className="mt-4 font-ch-display text-[22px] font-extrabold leading-tight text-ch-forest">{title}</p>
                <p className="mt-2 max-w-[36ch] text-[16px] leading-relaxed text-ch-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="scroll-mt-28 border-y border-ch-line bg-ch-shell">
          <div className="mx-auto max-w-[var(--ch-max)] px-5 py-[clamp(56px,8vw,104px)]">
            <Pricing2 visitor={visitor} />
          </div>
        </section>

        <section className="mx-auto max-w-[var(--ch-max)] px-5 py-[clamp(56px,8vw,104px)]">
          <h2 className="font-ch-display text-[22px] font-extrabold text-ch-forest">What we don’t do</h2>
          <ul className="mt-3 max-w-[64ch] border-t-2 border-ch-forest">
            {LIMITS.map((line) => (
              <li key={line} className="border-b border-ch-line py-3.5 text-[16px] leading-relaxed text-ch-ink-2">{line}</li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-[var(--ch-max)] px-5 pb-[clamp(64px,9vw,120px)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-[14ch] font-ch-display text-[clamp(36px,5vw,64px)] font-black leading-[1] tracking-[-.04em] text-ch-forest">Start with a search. It’s free.</h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <a href="#" className={buttonClasses({ size: "lg", className: "px-6" })}>
                <Search aria-hidden="true" className="size-4" />
                Find a campsite
              </a>
              <a href="#" className="min-h-11 content-center text-[16px] font-bold text-ch-forest underline decoration-ch-ochre decoration-2 underline-offset-[6px]">Or browse campgrounds by state</a>
            </div>
          </div>
          <figure className="tp-print mt-10">
            <Art art={ART.b1} sizes="(min-width: 1120px) 1080px, 92vw" className="block h-auto w-full" />
          </figure>
        </section>
      </main>
      <footer className="border-t border-ch-line bg-ch-shell">
        <div className="mx-auto flex max-w-[var(--ch-max)] flex-wrap items-center justify-between gap-3 px-5 py-6 text-ch-meta text-ch-muted">
          <span>© 2026 CampHawk</span>
          <nav aria-label="Footer" className="flex gap-1">
            {FOOTER_LINKS.map((l) => <a key={l} href="#" className="flex min-h-11 items-center px-2 hover:text-ch-ink hover:underline">{l}</a>)}
          </nav>
        </div>
      </footer>
    </div>
  );
}
