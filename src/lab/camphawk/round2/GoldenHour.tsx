"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Check, Search } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import { COVERAGE_SENTENCE, type Visitor } from "../data";
import { ROUTES } from "./gates";
import { useVisitor, withVisitor } from "./labState";
import { HEADLINE, INTRO, LIMITS, STEPS as CH_STEPS } from "../copy";
import { Tag } from "../ui/Tag";
import { DirectionLinks, LabBar } from "../LabBar";
import { GhFooter, PhotoHeader, ScreenLinks } from "./GhChrome";
import { Art, ART } from "./Art";
import { Pricing2 } from "./Pricing2";
import { WatchProofs } from "./WatchProofs";

// Round 2, direction A "Golden hour" (docs/design/camphawk-home.md): the moment a site opens, at
// the hour people dream about camping. The product proof (a live alert) sits on the photo, and
// search docks across the hero's bottom edge. Forest owns the hero and the proof section; paper
// grounds the reading. CampHawk's colour rules hold (its camphawk-design skill): green only for
// an open site or an action that gets one, blue for the Recreation.gov hand-off, ochre only for
// "you asked for this", every status in words, no glass or glows. The photo scrims are there
// for legibility, not decoration.

// Round-2 copy edit: "any N nights" is system language; say it the camper's way. Current keeps
// CampHawk's exact words (copy.ts).
const STEPS = CH_STEPS.map(([t, body]) => [t, body.replace("or any N nights inside a window you're free", "or how many nights you need inside a window you're free")] as const);

/** The proof on the photo: what an alert looks like. Labeled as an example; no real data. */
function AlertCard({ compact }: { compact?: boolean }) {
  return (
    <figure className={cx("rounded-ch-card border-[1.5px] border-ch-green bg-ch-card text-ch-ink", compact ? "p-3.5" : "gh-rise w-[310px] p-4 shadow-ch-pop")}>
      <div className="flex items-center gap-2 text-[13px]">
        <Tag kind="open">Open</Tag>
        <span className="font-extrabold">A site just opened</span>
        <span className="ml-auto text-ch-muted tabular-nums">14 sec ago</span>
      </div>
      <p className={compact ? "mt-2 font-ch-display text-[18px] font-extrabold leading-tight tracking-[-.02em]" : "mt-3 font-ch-display text-[20px] font-extrabold leading-tight tracking-[-.02em]"}>Upper Pines, site 042</p>
      <p className="mt-0.5 text-[14px] text-ch-ink-2 tabular-nums">Yosemite National Park. Open for Jul 18-21, 3 nights.</p>
      <p className="mt-2.5 flex items-center gap-1.5 rounded-ch-tag bg-ch-blue-soft px-2.5 py-2 text-[13.5px] font-bold text-ch-blue-deep">
        <Check aria-hidden="true" className="size-4 shrink-0" />
        In your Recreation.gov cart
      </p>
      <figcaption className="mt-2 text-[13px] text-ch-muted">Example alert</figcaption>
    </figure>
  );
}

/** Search, docked across the hero's bottom edge. It hands the place to the lab's Explore screen,
    which searches example data (never CampHawk's API). */
function SearchDock({ visitor }: { visitor: Visitor }) {
  const router = useRouter();
  return (
    <form
      role="search"
      action={ROUTES.explore}
      onSubmit={(e) => {
        e.preventDefault();
        const place = String(new FormData(e.currentTarget).get("where") ?? "").trim();
        router.push(withVisitor(`${ROUTES.explore}${place ? `?place=${encodeURIComponent(place)}` : ""}`, visitor));
      }}
      className="grid gap-3 rounded-ch-card bg-ch-card p-3 shadow-ch-pop sm:p-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-end">
      <label className="grid gap-1.5 px-1">
        <span className="text-ch-meta font-extrabold text-ch-ink-2">Where</span>
        <input type="text" name="where" placeholder="City, park, or ZIP…" autoComplete="off" className="min-h-12 rounded-ch-input border border-ch-line bg-ch-paper px-4 text-[16px] text-ch-ink placeholder:text-ch-muted" />
      </label>
      <label className="grid gap-1.5 px-1">
        <span className="text-ch-meta font-extrabold text-ch-ink-2">When</span>
        <input type="text" name="when" placeholder="3 nights in July…" autoComplete="off" className="min-h-12 rounded-ch-input border border-ch-line bg-ch-paper px-4 text-[16px] text-ch-ink placeholder:text-ch-muted" />
      </label>
      <button type="submit" className={buttonClasses({ className: "h-12 whitespace-nowrap px-6 text-[17px]" })}>
        <Search aria-hidden="true" className="size-4.5" />
        Search campgrounds free
      </button>
    </form>
  );
}

/** A phone showing the alert, then the cart: real UI, drawn in code. */
function PhoneProof() {
  return (
    <div aria-label="Example: the alert on a phone, then the site in your cart" role="img" className="mx-auto w-[290px] rounded-[44px] bg-ch-ink p-2.5 shadow-ch-pop">
      <div className="overflow-hidden rounded-[36px] bg-ch-paper text-ch-ink">
        <div className="relative h-[230px] overflow-hidden">
          <Art art={ART.a1} sizes="900px" className="absolute inset-0 size-full origin-[74%_88%] scale-[2.4] bg-ch-forest object-cover object-[74%_88%]" />
          <p className="relative pt-7 text-center font-ch-display text-[52px] font-bold leading-none text-ch-paper">6:02</p>
          <div className="absolute inset-x-3 bottom-3 rounded-[16px] bg-ch-card p-3 text-left">
            <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-ch-muted">
              <BellRing aria-hidden="true" className="size-3.5" /> CampHawk <span className="ml-auto font-bold">now</span>
            </p>
            <p className="mt-1 text-[13px] font-bold leading-snug text-ch-ink">Site 042 at Upper Pines is open for Jul 18-21. It&apos;s in your cart.</p>
          </div>
        </div>
        <div className="space-y-2.5 p-4">
          <p className="text-[13px] font-extrabold text-ch-ink-2">Recreation.gov cart</p>
          <div className="rounded-[14px] border border-ch-line bg-ch-card p-3">
            <p className="font-ch-display text-[16px] font-extrabold">Upper Pines, site 042</p>
            <p className="text-[13px] text-ch-ink-2 tabular-nums">Jul 18-21, 3 nights</p>
            <p className="mt-2 flex items-center gap-1 text-[13px] font-bold text-ch-blue-deep"><Check aria-hidden="true" className="size-3.5" /> Held in your cart</p>
          </div>
          <span className="flex min-h-10 items-center justify-center rounded-ch-btn border-2 border-ch-blue text-[13px] font-bold text-ch-blue-deep">Check out</span>
        </div>
      </div>
    </div>
  );
}

export function GoldenHour() {
  const [visitor, setVisitor] = useVisitor();
  return (
    <div className="gh">
      <LabBar page="Round 2" visitor={visitor} onVisitor={setVisitor}>
        <DirectionLinks current="golden-hour" />
        <ScreenLinks visitor={visitor} />
      </LabBar>
      <main id="main">
        <section className="relative isolate bg-ch-forest">
          <Art art={ART.a1} eager sizes="(max-width: 1023px) 2560px, 100vw" className="gh-photo" />
          <div aria-hidden="true" className="gh-scrim absolute inset-0" />
          <PhotoHeader visitor={visitor} />
          <div className="relative mx-auto grid max-w-[var(--gh-max)] px-5 pb-6 pt-[clamp(24px,6vh,96px)] sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-10 lg:pb-20">
            <div>
              <h1 className="max-w-[15ch] text-balance font-ch-display text-[clamp(40px,5.2vw,76px)] font-extrabold leading-[1] tracking-[-.03em] text-ch-paper">
                {HEADLINE}
              </h1>
              <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-ch-line sm:text-[18px]">{INTRO}</p>
              <a href="#watch" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[16px] font-bold text-ch-paper underline decoration-ch-faint decoration-2 underline-offset-[6px] hover:decoration-ch-paper">
                See what a watch does
              </a>
            </div>
            <div className="hidden lg:block lg:mt-4 lg:self-start">
              <AlertCard />
            </div>
          </div>
          {/* Phones and tablets: search right under the intro, the tent in a window below it.
              Desktop: search docks across the photo's bottom edge. */}
          <div className="relative mx-auto max-w-[var(--gh-max)] px-3 pb-[170px] sm:px-8 sm:pb-[300px] lg:pb-0">
            <div className="lg:translate-y-1/2">
              <SearchDock visitor={visitor} />
            </div>
          </div>
        </section>

        <div className="bg-ch-paper pt-6 lg:pt-24">
          <div className="mx-auto max-w-[var(--gh-max)] px-3 sm:px-8 lg:hidden">
            <AlertCard compact />
          </div>
          <p className="mx-auto mt-6 max-w-[var(--gh-max)] px-5 text-[16px] leading-relaxed text-ch-ink sm:px-8 lg:mt-0"><span className="block max-w-[64ch]">{COVERAGE_SENTENCE}</span></p>
        </div>

        <section id="watch" className="scroll-mt-4 bg-ch-paper">
          <div className="mx-auto max-w-[var(--gh-max)] px-5 pb-[clamp(72px,10vw,136px)] pt-[clamp(64px,9vw,120px)] sm:px-8">
            <h2 className="max-w-[16ch] text-balance font-ch-display text-[clamp(32px,4vw,52px)] font-extrabold leading-[1.02] tracking-[-.03em] text-ch-forest">What a watch does</h2>
            <p className="mt-3 text-[16px] text-ch-ink-2">Examples, not live data.</p>
            <div className="mt-10">
              <WatchProofs />
            </div>
          </div>
        </section>

        <section className="bg-ch-forest text-ch-paper">
          <div className="mx-auto grid max-w-[var(--gh-max)] items-center gap-14 px-5 py-[clamp(56px,8vw,104px)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-24 xl:pr-24">
            <div>
              <h2 className="font-ch-display text-[clamp(32px,4vw,52px)] font-extrabold leading-[1.02] tracking-[-.03em]">How it works</h2>
              <ol className="mt-10 grid gap-8">
                {STEPS.map(([title, body], i) => (
                  <li key={title} className="grid grid-cols-[48px_1fr] items-start gap-5">
                    <span className="grid size-12 place-items-center rounded-full border-2 border-ch-faint font-ch-display text-[22px] font-extrabold leading-none text-ch-paper tabular-nums">{i + 1}</span>
                    <div>
                      <p className="pt-2.5 font-ch-display text-[22px] font-bold tracking-[-.015em]">{title}</p>
                      <p className="mt-1.5 max-w-[48ch] text-[16px] leading-relaxed text-ch-line">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <PhoneProof />
          </div>
        </section>

        <section id="pricing" className="scroll-mt-4 border-b border-ch-line bg-ch-shell">
          <div className="mx-auto max-w-[var(--gh-max)] px-5 py-[clamp(64px,9vw,112px)] sm:px-8">
            <Pricing2 visitor={visitor} />
          </div>
        </section>

        <section className="bg-ch-paper">
          <div className="mx-auto grid max-w-[var(--gh-max)] gap-x-14 gap-y-3 px-5 py-[clamp(48px,6vw,72px)] sm:px-8 lg:grid-cols-2">
            <h2 className="font-ch-display text-[clamp(24px,2.6vw,32px)] font-bold leading-tight tracking-[-.02em] text-ch-ink lg:pt-3">What we don&apos;t do</h2>
            <ul className="max-w-[64ch] border-t border-ch-line">
              {LIMITS.map((line) => (
                <li key={line} className="border-b border-ch-line py-3.5 text-[16px] leading-relaxed text-ch-ink-2">{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative isolate overflow-hidden bg-ch-forest">
          <Art art={ART.a4} sizes="100vw" className="absolute inset-0 -z-10 size-full object-cover object-[20%_60%]" />
          <div aria-hidden="true" className="gh-band-scrim absolute inset-0 -z-10" />
          <div className="mx-auto flex min-h-[min(64vh,600px)] max-w-[var(--gh-max)] flex-col items-start justify-start px-5 py-14 sm:px-8 md:items-end md:justify-center md:text-right">
            <h2 className="max-w-[14ch] text-balance font-ch-display text-[clamp(36px,5vw,64px)] font-extrabold leading-[1] tracking-[-.03em] text-ch-paper">Start with a search. It&apos;s free.</h2>
            <div className="mt-6 flex flex-wrap items-center gap-4 md:justify-end">
              <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ size: "lg", className: "px-6" })}>
                <Search aria-hidden="true" className="size-4" />
                Find a campsite
              </Link>
              <a href="#" className="min-h-11 content-center text-[16px] font-bold text-ch-paper underline underline-offset-4">Or browse campgrounds by state</a>
            </div>
          </div>
        </section>
      </main>
      <GhFooter visitor={visitor} />
    </div>
  );
}
