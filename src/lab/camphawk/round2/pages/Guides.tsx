"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/cx";
import { BetaNote } from "../BareFrame";
import { WatchCtaLink } from "../AppParts";
import { ROUTES } from "../gates";
import { A, ActionLink, CtaBand, H2, LabNote, LabPage, P, Prose, Steps, Ul, WithRail } from "../LabPage";
import { CHECK_SECONDS, inWords, OPENINGS_STAT, openingsPercent, HOLD_STEPS, RC_HOLD_OPEN, SOURCE_COUNT, SOURCES_LINE } from "./tier2-data";

// Tier 2: the three public guides (campsite-finder src/app/(app)/auto-cart,
// campsite-cancellation-alerts, sold-out-campsite). Server pages in CampHawk, no account states,
// no prices (they render in the app too). Words are CampHawk's. What they keep on purpose:
// - The two auto-cart lanes are explained apart: Recreation.gov is a standing setting,
//   ReserveCalifornia is one tap per release, because a hold takes a site from everyone else.
// - The alerts page sends you to Recreation.gov's free alerts first. Leaving them out would read
//   as hoping you won't check.
// - The openings figure is a measured rate with its population and dates, and says it can't
//   predict your park.
// - Conversion is text links; no price on any of them.
// Lab changes, from CampHawk's own rules and copy:
// - "cancelled" is "canceled"; no ⚡ or ✅ emoji; headings are forest ink, not decorative green.
// - Counts come from the data-source list, so the pages agree ("fourteen sources", "twelve other
//   state systems"; CampHawk's say ten, twelve and fourteen in different places).
// - The ReserveCalifornia hold is described with the fact that it's closed to new holds since
//   Sep 22, 2026 (CampHawk's pages still offer it).
// - Dates are written out ("July 22 to September 4, 2026"), not printed raw as 2026-07-22.
// - The closing link goes to New watch through the watch gate, not to the marketing home.

const SAME_SOFTWARE = ["Arizona", "Florida", "Illinois", "Minnesota", "Missouri", "Nevada", "Ohio", "Virginia", "Wyoming"];
const statDates = `${OPENINGS_STAT.from} and ${OPENINGS_STAT.to}`;

/** The guide's step pattern, one look for both lanes: a numbered card with when, what, and the detail. */
function StepCards({ label, steps }: { label: string; steps: ReadonlyArray<readonly [when: string, what: string, detail: ReactNode]> }) {
  return (
    <ol aria-label={label} className="mt-6 grid gap-3 sm:grid-cols-2">
      {steps.map(([when, what, detail], i) => (
        <li key={what} className="rounded-ch-input border border-ch-line bg-ch-card p-4 shadow-ch-card sm:odd:last:col-span-2">
          <span className="flex items-center gap-2 text-[15px] font-bold text-ch-ink-2"><span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-ch-shell font-ch-display text-[13px] font-extrabold text-ch-ink">{i + 1}</span>{when}</span>
          <span className="mt-1 block text-[17px] font-bold leading-snug text-ch-ink">{what}</span>
          <span className="mt-2 block text-[15px] leading-relaxed text-ch-ink-2">{detail}</span>
        </li>
      ))}
    </ol>
  );
}

/** The study as a stat tile (one ratio is a headline, not a chart): the figure, what it counts,
    and one part-to-whole bar where the green sliver is the share that came back. The bar is
    decoration for the sentence beside it, so it's hidden from screen readers. */
function StatTile({ className }: { className?: string }) {
  const share = OPENINGS_STAT.openings / OPENINGS_STAT.checks;
  return (
    <figure className={cx("mt-6 rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-6", className)}>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="font-ch-display text-[56px] font-extrabold leading-none tracking-[-.03em] text-ch-ink tabular-nums">{openingsPercent()}</p>
        <p className="min-w-[14rem] flex-1 pb-1 text-[16px] leading-snug text-ch-ink-2"><strong className="font-bold text-ch-ink">{OPENINGS_STAT.openings.toLocaleString("en-US")} came back</strong> out of {OPENINGS_STAT.checks.toLocaleString("en-US")} checks of a sold-out stay.</p>
      </div>
      <div aria-hidden="true" className="mt-5 flex h-3 overflow-hidden rounded-[4px] bg-ch-shell">
        {/* At least 4px, so the sliver is visible at every width. */}
        <span className="h-full min-w-1 rounded-[4px] bg-ch-green" style={{ width: `${share * 100}%` }} />
      </div>
      <figcaption className="mt-2 flex justify-between text-[13px] text-ch-ink-2"><span>Came back</span><span>Still booked an hour later</span></figcaption>
    </figure>
  );
}
const sources = String(SOURCE_COUNT);

function Disclaimer({ visitor }: { visitor: Parameters<typeof A>[0]["visitor"] }) {
  return (
    <p className="mt-12 border-t border-ch-line pt-5 text-[14px] leading-relaxed text-ch-ink-2">
      CampHawk is an independent service and is not affiliated with, endorsed by or operated by Recreation.gov, the National Park Service, the US Forest Service, ReserveCalifornia or any state park agency. Reservation data comes from the sources listed on our <A href={ROUTES.sources} visitor={visitor}>data sources</A> page.
    </p>
  );
}

function HoldClosed() {
  if (RC_HOLD_OPEN) return null;
  return (
    <BetaNote className="mt-4" extra="Everyone’s ReserveCalifornia watches still alert as usual, and Recreation.gov auto-cart isn’t affected." />
  );
}

export function AutoCartGuide() {
  return (
    <LabPage page="Auto-cart" title="Auto‑cart and 8 AM holds" sub="On Recreation.gov we put the site in your cart. In California we hold it at the 8 AM release." dock={false}>
      {({ visitor }) => (
        <WithRail toc={[["first", "What you need first"], ["recgov", "Recreation.gov"], ["rc", "ReserveCalifornia"], ["good-to-know", "Good to know"]]}>
        <Prose>
          <P>Finding the cancellation is only half of it. The other half is getting the site before somebody else does — and CampHawk can do that part for you on <strong className="text-ch-ink">Recreation.gov</strong> and on <strong className="text-ch-ink">ReserveCalifornia</strong>. They work differently, because the two booking systems do, so they are explained separately below.</P>

          <H2 id="first" className="mt-12">What you need first</H2>
          <Ul items={[
            <>A <strong className="text-ch-ink">CampHawk account</strong> on the <A href={ROUTES.pricing} visitor={visitor}>Auto-Cart plan</A>, with at least one watch set up.</>,
            <>An account on the site you actually book on — <strong className="text-ch-ink">Recreation.gov</strong>, <strong className="text-ch-ink">ReserveCalifornia</strong>, or both.</>,
            "Nothing else. Each lane takes one setup step, once.",
          ]} />

          <H2 id="recgov">Recreation.gov — automatic carting</H2>
          <P>Cancellations on Recreation.gov happen at any hour, so this lane is a standing setting: once it’s on, a watched site that frees up is added to your cart within seconds, whatever time it is.</P>
          <StepCards label="Recreation.gov auto-cart, start to finish" steps={[
            ["Once", "Set your watches", <>Search for a campground, pick your dates, and tap the watch button on any booked campground. Auto-cart only acts on sites you’re watching.</>],
            ["Once", "Connect Recreation.gov", <>In <A href={ROUTES.settings} visitor={visitor}>Settings</A>, under Auto-cart, tap <strong className="text-ch-ink">Set up auto-cart</strong> and sign in to Recreation.gov. The login is saved, encrypted, on a private machine we run, never on our web servers.</>],
            ["From then on", "It’s already in your cart", <>When a watched site opens, it’s added to your cart within seconds and you get your normal alert. Open Recreation.gov on your phone and check out.</>],
          ]} />

          <H2 id="rc">ReserveCalifornia — a hold at the 8 AM release</H2>
          <HoldClosed />
          <P className="mt-6">California is different in a way that matters. When somebody cancels a ReserveCalifornia site, it usually doesn’t go back on sale immediately — it is locked until the next morning’s release, and then a lot of people are refreshing at once. So instead of watching for it all day, CampHawk spots the site the <strong className="text-ch-ink">night before</strong> and offers to be there at the moment it frees.</P>
          {/* The hold, start to finish: when each thing happens and what you do. */}
          <StepCards label="An 8 AM hold, start to finish" steps={[
            [...HOLD_STEPS[0], "Someone cancels; the site waits for the next 8 AM release. There’s nothing to switch on — just watch the campground you want."],
            [...HOLD_STEPS[1], <>You get an alert with a “Hold it for me” button. Nothing happens unless you tap it.</>],
            [...HOLD_STEPS[2], "Within a couple of seconds of the release, we put the site in a cart, so it’s off the market while you get to your phone."],
            [...HOLD_STEPS[3], <>Open the claim link, sign in to ReserveCalifornia and tap <strong className="text-ch-ink">It’s mine — hand it over</strong>. About two seconds later it’s in your cart.</>],
          ]} />

          <H2 id="good-to-know">Good to know</H2>
          <Ul items={[
            <><strong className="text-ch-ink">Why California needs the hand-off.</strong> A ReserveCalifornia cart belongs to the browser session that made it — a second session on the same account reads that cart as empty. So we can’t simply cart a site and leave it for you the way Recreation.gov allows; we hold it, you take it over, and the gap between those two is about two seconds.</>,
            <><strong className="text-ch-ink">Holds are California only.</strong> Of the states CampHawk watches, {inWords(SAME_SOFTWARE.length + 1)} share one booking platform — {SAME_SOFTWARE.slice(0, -1).join(", ")} and {SAME_SOFTWARE.at(-1)} alongside California — and <strong className="text-ch-ink">only ReserveCalifornia gets holds</strong>. For the others your alert carries a direct booking link: tap it on your phone and finish there. We’d rather say so than offer a button we can’t honor.</>,
            <><strong className="text-ch-ink">No standing setting on California, on purpose.</strong> A hold takes a real campsite off the market for everybody else watching it. That isn’t something to authorize weeks ahead in a settings screen, so it is authorized one release at a time, by you, the night before.</>,
            <><strong className="text-ch-ink">One grab per site.</strong> Once a specific site is carted for you, it won’t be re-added — but a different site opening in the same campground still will.</>,
            <>This automates <em>your own</em> account for personal use. Keep your watches current so it knows what to grab.</>,
          ]} />
          <CtaBand title="Find your campground, then let auto-cart do the fast part." body="Searching is free and needs no account." action={<WatchCtaLink visitor={visitor} fullWidth={false} onDark className="min-h-12 px-6" />} />
        </Prose>
        </WithRail>
      )}
    </LabPage>
  );
}

export function CancellationAlerts() {
  return (
    <LabPage page="Cancellation alerts" title="How campsite cancellation alerts work" sub="What actually separates one service from another, with our own numbers." dock={false}>
      {({ visitor }) => (
        <WithRail toc={[["how", "How they work"], ["speed", "How much speed matters"], ["free", "Check the free option first"], ["difference", "What still sets one apart"], ["checklist", "What to ask of any service"], ["start", "If you want to try ours"]]}>
        <Prose>
          <P>A cancellation alert service watches a campground you could not book and tells you when a site frees up. Every one of them does that. What separates them is how fast they notice, which reservation systems they can see, and whether they can do anything about it other than tell you.</P>

          <H2 id="how" className="mt-12">How they work</H2>
          <P>Reservation systems publish availability, so a service polls that availability on a loop and compares it with the last look. When a stay you asked for goes from booked to bookable, it sends you a text, an email or a push notification with a link.</P>
          <P>The whole game is the loop interval and what happens next. A service checking every few minutes will genuinely find you openings on quiet campgrounds; on a contested one it will reliably tell you about a site somebody else has already taken.</P>

          <H2 id="speed">How much speed matters, in numbers</H2>
          <P>Between {statDates} we checked {OPENINGS_STAT.campgrounds.toLocaleString("en-US")} hard-to-book campgrounds every hour. Of {OPENINGS_STAT.checks.toLocaleString("en-US")} checks on a stay that had sold out, {OPENINGS_STAT.openings.toLocaleString("en-US")} ({openingsPercent()}) found it bookable again. <A href={ROUTES.soldOut} visitor={visitor}>The sold-out guide</A> has the full study and what it does and doesn’t tell you.</P>
          <P>Rare, in other words, and then gone quickly. That’s why the interval is the specification worth reading and why “we check often” isn’t an answer. CampHawk rechecks every watched campground every {CHECK_SECONDS} seconds, continuously.</P>

          <H2 id="free">Check the free option first — we mean it</H2>
          <P>Recreation.gov has had its own availability alerts since 2024. They are free, they cover every reservable Recreation.gov location, and you’re limited to a few active alerts at a time. If your trip is a Recreation.gov campground and you’re happy to race everyone else to the booking page, start there. You should not pay for something the booking system gives away.</P>
          <P>There are free tiers elsewhere in this category too. It’s worth ten minutes to check whether one covers you before paying anybody, including us.</P>

          <H2 id="difference">What still sets one apart</H2>
          <Steps steps={[
            ["State reservation systems.", <>Recreation.gov’s alerts only cover Recreation.gov. A large share of the campgrounds people can’t book are on state and provincial systems — ReserveCalifornia above all — and those systems don’t offer alerts of their own. CampHawk watches <A href={ROUTES.sources} visitor={visitor}>{sources} sources</A>, and that is where most of what we find lives.</>],
            ["Doing something about it, not just telling you.", <>An alert still requires you to be holding your phone. On Recreation.gov we can <A href={ROUTES.autoCart} visitor={visitor}>put the site in your cart for you</A> — around twelve seconds from the opening appearing{RC_HOLD_OPEN ? " — and on ReserveCalifornia we can hold a site through the 8 AM release and hand it to you" : ""}. Recreation.gov will never build that; it would be carting against itself.</>],
          ]} />

          <H2 id="checklist">What to ask of any service</H2>
          <Ul items={[
            "How often does it actually check, in seconds?",
            "Does it cover your reservation system, or only Recreation.gov?",
            "Can it handle flexible dates, or only one exact stay?",
            "Does it text you, or only email? An email at 3 AM isn’t an alert.",
            "Does it do anything beyond notifying you?",
            "Can you cancel in one click without emailing anybody?",
          ]} />

          <H2 id="start">If you want to try ours</H2>
          <P><A href={ROUTES.explore} visitor={visitor}>Search campgrounds</A> across all {sources} sources, and if it is booked out, <A href={ROUTES.soldOut} visitor={visitor}>here is what actually works</A>. Watching and alerts are paid; <A href={ROUTES.pricing} visitor={visitor}>the plans are here</A>.</P>
          {/* Every guide ends the same way: one band, one action. */}
          <CtaBand title="Find your campground, then let us watch it." body="Searching is free and needs no account." action={<ActionLink href={ROUTES.explore} visitor={visitor} variant="primary">Search campgrounds</ActionLink>} />
          <Disclaimer visitor={visitor} />
          <LabNote className="mt-8">The openings study is CampHawk’s real measurement, July 22 to September 4, 2026. The lab’s example watches are dated as if today were July 6, so the two don’t share a calendar.</LabNote>
        </Prose>
        </WithRail>
      )}
    </LabPage>
  );
}

export function SoldOutGuide() {
  return (
    <LabPage page="Sold-out guide" title="The campground is fully booked. Here’s what actually works." sub="How often sold-out sites come back, measured, and how to be the one who books it." dock={false}>
      {({ visitor }) => (
        <WithRail toc={[["how-often", "How often sites come back"], ["windows", "Sold out, or not open yet?"], ["cancellations", "Why sites come back"], ["what-works", "What to actually do"], ["camphawk", "Where CampHawk fits"]]}>
        <Prose>
          <P>Sold out is rarely final. Reservations get canceled, held carts expire, and parks put inventory back. The problem is that the site is usually gone again within minutes, so the question isn’t whether one will appear — it is whether you will be looking at the moment it does.</P>

          <H2 id="how-often" className="mt-12">How often does a sold‑out site actually come back?</H2>
          <P>We can answer this with our own data rather than a guess. Between {statDates} we checked {OPENINGS_STAT.campgrounds.toLocaleString("en-US")} hard-to-book campgrounds every hour, and looked only at stays that had been fully booked at the previous check, so a stay that never sold out doesn’t count.</P>
          <StatTile />
          <P className="mt-4">That’s the honest shape of it: on any given hour, almost certainly nothing. Over a few weeks of watching, quite often something. It’s also why refreshing the booking page yourself is such poor odds — you’d have to be looking during the one hour in a hundred that matters, and then be faster than everyone else looking too.</P>
          <P className="mt-4 text-[15px]">That’s a rate across a population of famously difficult campgrounds; your park will differ. We won’t pretend it predicts yours.</P>

          <H2 id="windows">First: check whether it’s sold out, or just not open yet</H2>
          <P>These are different problems and they look identical on the booking page. Most parks sell a rolling window — Recreation.gov and ReserveCalifornia both open reservations six months ahead — so a date beyond that window shows nothing available because nothing has been released, not because anyone booked it.</P>
          <P>If that’s your situation, you don’t need a cancellation at all. You need to be there when the window opens, which happens at a fixed local time and is over in seconds. ReserveCalifornia’s booking window opens at 8 AM Pacific, and we’ve measured it to the second: new dates flip from locked to bookable within a couple of seconds of 8:00:00. Its cancellations are released at that same 8 AM, which is what an <A href={ROUTES.autoCart} visitor={visitor}>8 AM hold</A> is for.</P>

          <H2 id="cancellations">Why sites come back at all</H2>
          <P>Three things, and they behave differently:</P>
          <Ul items={[
            <><strong className="text-ch-ink">Someone cancels.</strong> Most common as the trip gets close and plans change, but we see them at every lead time — including months out.</>,
            <><strong className="text-ch-ink">A held cart expires.</strong> Someone put the site in a cart and didn’t check out. It comes back automatically, often within about fifteen minutes.</>,
            <><strong className="text-ch-ink">The park releases inventory.</strong> Sites held back for maintenance, group bookings or walk-ups get returned to the pool, sometimes in batches.</>,
          ]} />
          <P>All three produce the same thing from your side: a site that was gone is suddenly bookable, usually without warning and usually not for long.</P>

          <H2 id="what-works">What to actually do</H2>
          <Steps steps={[
            ["Widen the dates before you widen the park.", "A midweek night at the campground you want beats a Saturday at your third choice, and midweek openings are far easier to catch."],
            ["Set the alert and stop refreshing.", "Watching by hand is the part that doesn’t scale — see the numbers above."],
            ["Be ready to book in under a minute.", "Be signed in to the reservation site in advance, with your details saved. The gap between an alert and the site being gone is measured in minutes."],
            ["Don’t stop watching once the alert arrives.", "If somebody beats you to it, the same site frequently frees again."],
          ]} />

          <H2 id="camphawk">Where CampHawk fits</H2>
          <P>We check every watched campground every {CHECK_SECONDS} seconds, across {SOURCES_LINE}, and text, email or push you the moment a stay you asked for becomes bookable.</P>
          <P>On Recreation.gov we can also <A href={ROUTES.autoCart} visitor={visitor}>put the site in your cart automatically</A> — measured at about twelve seconds from the site opening to it being held for you{RC_HOLD_OPEN ? " — and on ReserveCalifornia we can hold a site through the 8 AM release and hand it over" : ""}. That’s the part a plain alert can’t do, because by the time you’ve read a text and opened an app, the fast people are already at checkout.</P>
          <P>Watching and alerts are paid; <A href={ROUTES.pricing} visitor={visitor}>see the plans</A>.</P>
          <CtaBand title="Find your campground, then let us watch it." body="Searching is free and needs no account." action={<ActionLink href={ROUTES.explore} visitor={visitor} variant="primary">Search campgrounds</ActionLink>} />
          <Disclaimer visitor={visitor} />
          <LabNote className="mt-8">The openings study is CampHawk’s real measurement, July 22 to September 4, 2026. The lab’s example watches are dated as if today were July 6, so the two don’t share a calendar.</LabNote>
        </Prose>
        </WithRail>
      )}
    </LabPage>
  );
}
