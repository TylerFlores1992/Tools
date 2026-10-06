"use client";

import type { ReactNode } from "react";
import { buttonClasses } from "../../ui";
import { CAMPGROUNDS_ROUNDED, PLAN_PRICE, dollars, pricePhrase, priceShort } from "../../data";
import { ART } from "../Art";
import { ROUTES } from "../gates";
import { A, LabPage, WithRail } from "../LabPage";
import { withVisitor } from "../labState";
import Link from "next/link";
import { COMPETITORS, COVERAGE, type Competitor } from "./camping-data";
import { CHECK_SECONDS, RC_HOLD_CLOSED_ON, RC_HOLD_OPEN, SOURCE_COUNT, TRIAL_DAYS } from "./tier2-data";

// Tier 3: CampHawk vs Campflare / Campnab (campsite-finder src/components/v2/ComparisonPage.tsx,
// lib/competitors.ts). THERE IS NO COMPARISON TABLE, BY DESIGN: CampHawk makes no claim about a
// competitor it hasn't verified and quotes none of their prices or features; its tests fail the
// build on any. The page says what CampHawk does, the questions to ask any service, and when not
// to buy from us. What it keeps on purpose:
// - "You might not need to pay anyone" comes first, naming Recreation.gov's free alerts.
// - "Take the answers from each service's own site … this one included."
// - Every number is derived (sources, coverage, prices).
// Lab changes: the heading is forest ink (CampHawk's is decorative green); "cancelled" is
// "canceled"; the ReserveCalifornia hold says it's closed to new holds (since Sep 22, 2026);
// inside the app the price answer gives no price (CampHawk shows one there, against the store
// rule); outside links say where they go.

function Q({ q, children }: { q: ReactNode; children: ReactNode }) {
  return (
    <li className="border-t border-ch-line py-5 first:border-t-0 first:pt-0">
      <h3 className="font-ch-display text-[19px] font-extrabold leading-snug text-ch-ink">{q}</h3>
      <div className="mt-2 text-[17px] leading-relaxed text-ch-ink-2">{children}</div>
    </li>
  );
}

const Out = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} rel="noopener nofollow" target="_blank" className="font-bold text-ch-forest underline decoration-1 underline-offset-[3px] hover:decoration-2">{children}<span className="sr-only"> (opens their site)</span></a>
);

export function Comparison({ slug }: { slug: Competitor["slug"] }) {
  const c = COMPETITORS[slug];
  return (
    <LabPage page={`vs ${c.name}`} title={`CampHawk vs ${c.name}`} dock={false} photo={{ art: ART.v1, pos: "75% 55%", posLg: "50% 58%" }}>
      {({ visitor }) => (
        <WithRail toc={[["start", "You might not need to pay"], ["does", "What CampHawk does"], ["ask", "What to ask any service"]]}>
        <div className="max-w-[46rem]">
          <p className="text-[18px] leading-relaxed text-ch-ink-2">{c.known} So does CampHawk. Rather than tell you what {c.name} does — their site is the honest source for that, and it&apos;s <Out href={c.homepage}>right here</Out> — this page says exactly what CampHawk does, so you can check it against whatever else you&apos;re looking at.</p>

          <section aria-labelledby="start" className="mt-8 rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-7">
            <h2 id="start" className="font-ch-display text-[20px] font-extrabold text-ch-ink">Start here: you might not need to pay anyone</h2>
            <p className="mt-2 text-[17px] leading-relaxed text-ch-ink-2">Since July 2024, <strong className="text-ch-ink">Recreation.gov has its own free cancellation alerts</strong>. If every trip you take is a federal campground — national parks, national forests, Corps of Engineers — turn those on first and see whether they&apos;re enough. We would rather you found that out here than a month after paying us.</p>
            <p className="mt-3 text-[17px] leading-relaxed text-ch-ink-2">Two things a free federal alert cannot do, and they are the whole reason CampHawk exists: it does not cover <strong className="text-ch-ink">state parks</strong>, and it does not <strong className="text-ch-ink">book anything for you</strong>. An alert still means you racing to a checkout page against everyone else who got the same alert.</p>
          </section>

          <h2 id="does" className="mt-12 scroll-mt-6 font-ch-display text-[clamp(24px,2.6vw,30px)] font-extrabold text-ch-forest">What CampHawk does</h2>
          <ul className="mt-5">
            <Q q={`${SOURCE_COUNT} data sources, not just Recreation.gov`}>
              {CAMPGROUNDS_ROUNDED} campgrounds across all {COVERAGE.states} states, with state-park coverage in {COVERAGE.stateParkStates} of them, plus Parks Canada and {COVERAGE.canadianProvincialSystems} provincial and territorial park systems. That&apos;s {SOURCE_COUNT} sources in all, from Recreation.gov and ReserveCalifornia to the systems several states and provinces share. Every source is named on our <A href={ROUTES.sources} visitor={visitor}>data sources page</A>, so you can check the coverage for the parks you actually book before you pay.
            </Q>
            <Q q="It can put the site in your cart, not just tell you about it">
              On Recreation.gov, the Auto-Cart plan signs into your own account and adds a canceled site to your cart within seconds of it opening — so you check out from your phone instead of racing a notification. That is the difference between knowing about a cancellation and getting it. <A href={ROUTES.autoCart} visitor={visitor}>How it works</A>.
            </Q>
            <Q q="ReserveCalifornia sites are held at the 8 AM release">
              California cancellations mostly don&apos;t go back on sale straight away — they are locked until the next morning&apos;s release, when everybody refreshes at once. CampHawk spots the site the night before, offers to be there, and carts it within a couple of seconds of it freeing, then hands it to you.{" "}
              {RC_HOLD_OPEN
                ? <span className="text-[15px]">Auto-hold is in beta. It has worked on real releases, and it can still miss — set an alarm for the release time and be ready to book it yourself.</span>
                : <strong className="text-ch-ink">Invite-only since {RC_HOLD_CLOSED_ON}, while we make it more reliable; ReserveCalifornia watches still alert everyone.</strong>}
            </Q>
            <Q q={`Checks every ${CHECK_SECONDS} seconds`}>Not a sweep every few minutes: every watched campground is rechecked every {CHECK_SECONDS} seconds, around the clock, which is what makes carting within seconds possible at all.</Q>
            <Q q="Flexible dates, and per-site muting">Watch for &ldquo;any two nights in this window&rdquo; rather than one fixed range — which, on a popular weekend, is usually the difference between getting something and getting nothing. And if one loop keeps opening and you don&apos;t want it, mute that site instead of the whole campground.</Q>
            {visitor === "app" ? (
              <Q q="Plans, and a free trial">There is a free trial, and you can cancel any time from your store&apos;s subscription settings. See the plans in <A href={ROUTES.settings} visitor={visitor}>Settings</A>.</Q>
            ) : (
              <Q q={`${pricePhrase("base", "monthly")}, or ${dollars(PLAN_PRICE.autocart.monthly)} if you want the carting`}>
                {priceShort("base", "monthly")} or {priceShort("base", "yearly")} for alerts; {priceShort("autocart", "monthly")} or {priceShort("autocart", "yearly")} for the Auto-Cart plan. There is a {TRIAL_DAYS}-day free trial and you can cancel from your own settings. <A href={ROUTES.pricing} visitor={visitor}>Pricing</A>.
              </Q>
            )}
          </ul>

          <h2 id="ask" className="mt-12 scroll-mt-6 font-ch-display text-[clamp(24px,2.6vw,30px)] font-extrabold text-ch-forest">What to ask before you pick one</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-ch-ink-2">These are the questions that actually decide whether a cancellation service works for your trip. Ask them of {c.name}, of us, and of anyone else — and take the answers from each service&apos;s own site rather than from a rival&apos;s comparison page, this one included.</p>
          <ul className="mt-6">
            <Q q="Does it cover the booking system your campground actually uses?">The single most common way one of these tools disappoints someone. A service that only reads Recreation.gov is no use for a California state park, and vice versa. Look up your specific campground before you pay.</Q>
            <Q q="Does it only notify, or can it book?">On a popular site an alert can be twenty people racing the same checkout. Ask whether the tool does anything after the notification.</Q>
            <Q q="How often does it check, and does it say?">&ldquo;Real-time&rdquo; is not a number. A tool that checks every few minutes and one that checks every few seconds are different products at the same price.</Q>
            <Q q="Can it do flexible dates?">If you can move a night either way, a service that only takes a fixed range is throwing away most of your chances.</Q>
            <Q q="What happens when there are no cancellations?">Sometimes there simply aren&apos;t any — a popular weekend can go quiet for a week. Ask what you are paying for in that case, and how easily you can stop.</Q>
          </ul>

          <section className="mt-10 rounded-ch-card bg-ch-forest px-6 py-10 text-center">
            <h2 className="font-ch-display text-[clamp(24px,3vw,32px)] font-extrabold text-ch-paper">Search is free, and needs no account</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-[17px] leading-relaxed text-ch-line">Look up the campground you want and see what CampHawk knows about it before you decide anything.</p>
            <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ size: "lg", className: "mt-6 px-6" })}>Search a campground</Link>
          </section>
          <p className="mt-8 text-[14px] leading-relaxed text-ch-ink-2">{c.name} is not affiliated with CampHawk, and we don&apos;t speak for them. Everything above describes CampHawk; for {c.name}&apos;s features and prices, <Out href={c.homepage}>see their site</Out>.</p>
        </div>
        </WithRail>
      )}
    </LabPage>
  );
}
