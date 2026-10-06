"use client";

import { Info } from "lucide-react";
import { ART } from "../Art";
import { WatchCtaLink } from "../AppParts";
import { ROUTES } from "../gates";
import { A, Callout, CtaBand, H2, LabPage, P, Prose, Steps, Ul } from "../LabPage";
import { CHECK_SECONDS, OPENINGS_STAT, RC_HOLD_CLOSED_ON, RC_HOLD_OPEN, SOURCE_COUNT, inWords, openingsPercent } from "./tier2-data";

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
const sources = inWords(SOURCE_COUNT);
const otherStateSystems = inWords(SOURCE_COUNT - 2);

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
    <Callout title={<span className="flex items-center gap-2"><Info aria-hidden="true" className="size-5 shrink-0" />Closed to new holds for now</span>}>
      We paused ReserveCalifornia holds on {RC_HOLD_CLOSED_ON} while we make them more reliable. Your ReserveCalifornia watches still alert you as usual; below is how holds work when they reopen.
    </Callout>
  );
}

export function AutoCartGuide() {
  return (
    <LabPage page="Auto-cart" title="Auto‑cart — how it works" dock={false} photo={{ art: ART.n1, pos: "62% 55%", posLg: "50% 60%" }}>
      {({ visitor }) => (
        <Prose>
          <P>Finding the cancellation is only half of it. The other half is getting the site before somebody else does — and CampHawk can do that part for you on <strong className="text-ch-ink">Recreation.gov</strong> and on <strong className="text-ch-ink">ReserveCalifornia</strong>. They work differently, because the two booking systems do, so they are explained separately below.</P>

          <H2 id="first" className="mt-12">What you need first</H2>
          <Ul items={[
            <>A <strong className="text-ch-ink">CampHawk account</strong> on the <A href={ROUTES.pricing} visitor={visitor}>Auto-Cart plan</A>, with at least one watch set up.</>,
            <>An account on the site you actually book on — <strong className="text-ch-ink">Recreation.gov</strong>, <strong className="text-ch-ink">ReserveCalifornia</strong>, or both.</>,
            "Nothing else. Each lane takes one setup step, once.",
          ]} />

          <H2 id="recgov">Recreation.gov — automatic carting</H2>
          <P>Cancellations on Recreation.gov happen at any hour, so this lane is a standing setting: once it is on, a watched site that frees up is added to your cart within seconds, whatever time it is.</P>
          <Steps steps={[
            ["Set your watches", <>Search for a campground, pick your dates, and tap <strong className="text-ch-ink">Watch this campground</strong> on any booked site. Auto-cart only acts on sites you&apos;re watching.</>],
            ["Turn on auto-cart", <>Go to <A href={ROUTES.settings} visitor={visitor}>Settings</A> and, under <strong className="text-ch-ink">Auto-cart</strong>, tap <strong className="text-ch-ink">Set up auto-cart</strong>. Once it&apos;s connected the same block gives you a <strong className="text-ch-ink">Turn on</strong> / <strong className="text-ch-ink">Turn off</strong> switch.</>],
            ["Sign in to Recreation.gov once", <>You enter your Recreation.gov email and password once. They&apos;re saved, <strong className="text-ch-ink">encrypted, on a private machine we run</strong> — the always-on computer that holds your logged-in browser — so auto-cart signs back in by itself if the session drops. <strong className="text-ch-ink">They never reach CampHawk&apos;s web servers or database.</strong></>],
            ["You're done", <>From now on, when a watched site opens, it&apos;s added to your cart within seconds. You get your normal CampHawk alert — open Recreation.gov on your phone, and it&apos;s already in your cart. Just <strong className="text-ch-ink">check out</strong>.</>],
          ]} />

          <H2 id="rc">ReserveCalifornia — a hold at the 8 AM release</H2>
          <HoldClosed />
          <P className="mt-6">California is different in a way that matters. When somebody cancels a ReserveCalifornia site, it usually does not go back on sale immediately — it is locked until the next morning&apos;s release, and then a lot of people are refreshing at once. So instead of watching for it all day, CampHawk spots the site the <strong className="text-ch-ink">night before</strong> and offers to be there at the moment it frees.</P>
          <Steps steps={[
            ["Watch a ReserveCalifornia campground", "There is nothing to switch on, and that is deliberate — see below. Just watch the park you want."],
            ["The evening before, we offer", <>When we see a site that is about to be released, you get an alert with a <strong className="text-ch-ink">Hold it for me</strong> button. <strong className="text-ch-ink">Nothing happens unless you tap it.</strong></>],
            ["At the release, we cart it", "At 8 AM, within a couple of seconds of the site actually freeing, our bot puts it in a cart — so it is off the market while you get to your phone, instead of gone to whoever refreshed fastest."],
            ["You take it over", <>Open the claim link, sign in to ReserveCalifornia, and tap <strong className="text-ch-ink">hand it over</strong>. We release the site and your own session carts it, about two seconds later. Then you check out as normal.</>],
          ]} />
          <Callout>
            <p>Auto-hold is in beta. It has worked on real releases, and it can still miss — set an alarm for the release time and be ready to book it yourself.</p>
            <p className="mt-2">This is about ReserveCalifornia holds only — Recreation.gov auto-cart is not affected.</p>
          </Callout>

          <H2 id="good-to-know">Good to know</H2>
          <Ul items={[
            <><strong className="text-ch-ink">Why California needs the hand-off.</strong> A ReserveCalifornia cart belongs to the browser session that made it — a second session on the same account reads that cart as empty. So we cannot simply cart a site and leave it for you the way Recreation.gov allows; we hold it, you take it over, and the gap between those two is about two seconds.</>,
            <><strong className="text-ch-ink">Holds are California only.</strong> CampHawk watches {inWords(SAME_SOFTWARE.length + 1)} state park systems that run on the same booking software — {SAME_SOFTWARE.slice(0, -1).join(", ")} and {SAME_SOFTWARE.at(-1)} alongside California — and <strong className="text-ch-ink">only ReserveCalifornia gets holds</strong>. For the others your alert carries a direct booking link: tap it on your phone and finish there. We would rather say so than offer a button we cannot honor.</>,
            <><strong className="text-ch-ink">No standing setting on California, on purpose.</strong> A hold takes a real campsite off the market for everybody else watching it. That is not something to authorize weeks ahead in a settings screen, so it is authorized one release at a time, by you, the night before.</>,
            <><strong className="text-ch-ink">One grab per site.</strong> Once a specific site is carted for you, it won&apos;t be re-added — but a different site opening in the same campground still will.</>,
            <><strong className="text-ch-ink">Cancellations move fast.</strong> Getting it into your Recreation.gov cart buys you time, but Recreation.gov only holds a cart for a matter of minutes — check out promptly.</>,
            <>This automates <em>your own</em> account for personal use. Keep your watches current so it knows what to grab.</>,
          ]} />
          <CtaBand title="Set up a watch, and let auto-cart do the fast part." action={<WatchCtaLink visitor={visitor} fullWidth={false} className="min-h-12 px-6" />} />
        </Prose>
      )}
    </LabPage>
  );
}

export function CancellationAlerts() {
  return (
    <LabPage page="Cancellation alerts" title="Campsite cancellation alerts: how they work, and what actually differs" dock={false} photo={{ art: ART.e1, pos: "50% 55%", posLg: "50% 55%" }}>
      {({ visitor }) => (
        <Prose>
          <P>A cancellation alert service watches a campground you could not book and tells you when a site frees up. Every one of them does that. What separates them is how fast they notice, which reservation systems they can see, and whether they can do anything about it other than tell you.</P>

          <H2 id="how" className="mt-12">How they work</H2>
          <P>Reservation systems publish availability, so a service polls that availability on a loop and compares it with the last look. When a stay you asked for goes from booked to bookable, it sends you a text, an email or a push notification with a link.</P>
          <P>The whole game is the loop interval and what happens next. A service checking every few minutes will genuinely find you openings on quiet campgrounds; on a contested one it will reliably tell you about a site somebody else has already taken.</P>

          <H2 id="speed">How much speed matters, in numbers</H2>
          <P>Between {statDates} we watched {OPENINGS_STAT.campgrounds.toLocaleString("en-US")} hard-to-book campgrounds every hour and counted only genuine openings — a stay that had been fully booked becoming bookable again. It happened {OPENINGS_STAT.openings.toLocaleString("en-US")} times in {OPENINGS_STAT.checks.toLocaleString("en-US")} checks, about {openingsPercent()} of them.</P>
          <P>Rare, in other words, and then gone quickly. That is why the interval is the specification worth reading and why “we check often” is not an answer. CampHawk rechecks every watched campground every {CHECK_SECONDS} seconds, continuously.</P>

          <H2 id="free">Check the free option first — we mean it</H2>
          <P>Recreation.gov has had its own availability alerts since 2024. They are free, they cover every reservable Recreation.gov location, and you are limited to a few active alerts at a time. If your trip is a Recreation.gov campground and you are happy to race everyone else to the booking page, start there. You should not pay for something the booking system gives away.</P>
          <P>There are free tiers elsewhere in this category too. It is worth ten minutes to check whether one covers you before paying anybody, including us.</P>

          <H2 id="difference">The two things that survive that</H2>
          <Steps steps={[
            ["State reservation systems.", <>Recreation.gov&apos;s alerts only cover Recreation.gov. A large share of the campgrounds people cannot book are on state systems — ReserveCalifornia above all, plus a dozen others — and those systems do not offer alerts of their own. CampHawk watches <A href={ROUTES.sources} visitor={visitor}>{sources} sources</A>, and that is where most of what we find lives.</>],
            ["Doing something about it, not just telling you.", <>An alert still requires you to be holding your phone. On Recreation.gov we can <A href={ROUTES.autoCart} visitor={visitor}>put the site in your cart for you</A> — around twelve seconds from the opening appearing{RC_HOLD_OPEN ? " — and on ReserveCalifornia we can hold a site through the 8 AM release and hand it to you" : ""}. Recreation.gov will never build that; it would be carting against itself.</>],
          ]} />

          <H2 id="checklist">What to ask of any service, including this one</H2>
          <Ul items={[
            "How often does it actually check, in seconds?",
            "Does it cover your reservation system, or only Recreation.gov?",
            "Can it handle flexible dates, or only one exact stay?",
            "Does it text you, or only email? An email at 3am is not an alert.",
            "Does it do anything beyond notifying you?",
            "Can you cancel in one click without emailing anybody?",
          ]} />

          <H2 id="start">If you want to try ours</H2>
          <P>Searching is free — you can check availability across all {sources} systems without an account. <A href={ROUTES.explore} visitor={visitor}>Find your campground</A>, and if it is booked out, <A href={ROUTES.soldOut} visitor={visitor}>here is what actually works</A>. Watching and alerts are paid; <A href={ROUTES.pricing} visitor={visitor}>the plans are here</A>.</P>
          <Disclaimer visitor={visitor} />
        </Prose>
      )}
    </LabPage>
  );
}

export function SoldOutGuide() {
  return (
    <LabPage page="Sold-out guide" title="The campground is fully booked. Here's what actually works." dock={false} photo={{ art: ART.a1, pos: "62% 70%", posLg: "50% 72%" }}>
      {({ visitor }) => (
        <Prose>
          <P>Sold out is rarely final. Reservations get canceled, held carts expire, and parks put inventory back. The problem is that the site is usually gone again within minutes, so the question is not whether one will appear — it is whether you will be looking at the moment it does.</P>

          <H2 id="how-often" className="mt-12">How often does a sold‑out site actually come back?</H2>
          <P>We can answer this with our own data rather than a guess. Between {statDates} we checked {OPENINGS_STAT.campgrounds.toLocaleString("en-US")} hard-to-book campgrounds every hour and counted only the moments when a stay that had been fully booked became bookable again — a real opening, not a stay that had simply never sold out.</P>
          <Callout title={`${OPENINGS_STAT.openings.toLocaleString("en-US")} openings across ${OPENINGS_STAT.checks.toLocaleString("en-US")} checks — about ${openingsPercent()} of the time.`}>
            That is the honest shape of it: on any given hour, almost certainly nothing. Over a few weeks of watching, quite often something. It is also why refreshing the booking page yourself is such poor odds — you would have to be looking during the one hour in a hundred that matters, and then be faster than everyone else looking too.
          </Callout>
          <P className="mt-4 text-[15px]">That is a rate across a population of famously difficult campgrounds; your park will differ. We are not going to pretend it predicts yours.</P>

          <H2 id="windows">First: check whether it is sold out, or just not open yet</H2>
          <P>These are different problems and they look identical on the booking page. Most parks sell a rolling window — Recreation.gov and ReserveCalifornia both open reservations six months ahead — so a date beyond that window shows nothing available because nothing has been released, not because anyone booked it.</P>
          <P>If that is your situation, you do not need a cancellation at all. You need to be there when the window opens, which happens at a fixed local time and is over in seconds. We have measured ReserveCalifornia&apos;s 8 AM Pacific release to the second: sites flip from locked to bookable within a couple of seconds either side of 8:00:00.</P>

          <H2 id="cancellations">Why sites come back at all</H2>
          <P>Three things, and they behave differently:</P>
          <Ul items={[
            <><strong className="text-ch-ink">Someone cancels.</strong> Most common as the trip gets close and plans change, but we see them at every lead time — including months out.</>,
            <><strong className="text-ch-ink">A held cart expires.</strong> Someone put the site in a cart and did not check out. It comes back automatically, often within about fifteen minutes.</>,
            <><strong className="text-ch-ink">The park releases inventory.</strong> Sites held back for maintenance, group bookings or walk-ups get returned to the pool, sometimes in batches.</>,
          ]} />
          <P>All three produce the same thing from your side: a site that was gone is suddenly bookable, usually without warning and usually not for long.</P>

          <H2 id="what-works">What to actually do</H2>
          <Steps steps={[
            ["Widen the dates before you widen the park.", "A midweek night at the campground you want beats a Saturday at your third choice, and midweek openings are far easier to catch."],
            ["Set the alert and stop refreshing.", "Watching by hand is the part that does not scale — see the numbers above."],
            ["Be ready to book in under a minute.", "Be signed in to the reservation site in advance, with your details saved. The gap between an alert and the site being gone is measured in minutes."],
            ["Do not stop watching once the alert arrives.", "If somebody beats you to it, the same site frequently frees again."],
          ]} />

          <H2 id="camphawk">Where CampHawk fits</H2>
          <P>We check every watched campground every {CHECK_SECONDS} seconds, across Recreation.gov, ReserveCalifornia and {otherStateSystems} other state reservation systems, and text, email or push you the moment a stay you asked for becomes bookable.</P>
          <P>On Recreation.gov we can also <A href={ROUTES.autoCart} visitor={visitor}>put the site in your cart automatically</A> — measured at about twelve seconds from the site opening to it being held for you{RC_HOLD_OPEN ? " — and on ReserveCalifornia we can hold a site through the 8 AM release and hand it over" : ""}. That is the part a plain alert cannot do, because by the time you have read a text and opened an app, the fast people are already at checkout.</P>
          <P><A href={ROUTES.explore} visitor={visitor}>Find your campground</A> — searching is free. Watching and alerts are paid; <A href={ROUTES.pricing} visitor={visitor}>see the plans</A>.</P>
          <Disclaimer visitor={visitor} />
        </Prose>
      )}
    </LabPage>
  );
}
