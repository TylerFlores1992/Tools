"use client";

import type { ReactNode } from "react";
import { ART } from "../Art";
import { ROUTES } from "../gates";
import { A, Callout, H2, LabNote, LabPage, P, Prose, Ul, WithRail } from "../LabPage";
import { COVERAGE } from "./camping-data";
import { SOURCE_COUNT } from "./tier2-data";
import { SmsAlerts } from "../SmsAlerts";
import { ADDITIONAL_PORTALS, AFFILIATION_DISCLAIMER, DATA_SOURCES } from "./sources-data";
import type { Visitor } from "../../data";

// Tier 4 in the Golden hour look: CampHawk's utility and legal pages (campsite-finder
// src/app/(app)/support, sources, sms-opt-in, privacy, terms), word for word. Spec:
// docs/design/camphawk-home.md, "Tier 4". What it keeps on purpose:
// - No prices on Support or Data sources: both open inside the native app (store rules).
// - Data sources leads with the "not a government app" disclaimer (Google Play rejected the
//   listing when it sat at the bottom), and prints every official URL as text as well as a link.
// - The SMS page renders the same form as Settings, in a preview mode; its wording is
//   carrier-approved and unchanged.
// - Privacy and Terms are CampHawk's text as published, dates included.
// Lab changes: US spelling where CampHawk's Support says "cancelled"/"Cancelling"; headings in
// Bitter; links in forest ink, not action green; the SMS "optional" notice is a neutral card.

const EMAIL = "alerts@camphawk.app";
const Mail = () => <A href={`mailto:${EMAIL}`}>{EMAIL}</A>;

/** A long page's sections, with a sticky "On this page" list beside them on wide screens. */
function Sections({ sections, aside }: { sections: ReadonlyArray<{ id: string; title: string; body: ReactNode }>; aside?: ReactNode }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16">
      <Prose>
        {sections.map((s) => (
          <section key={s.id} aria-labelledby={s.id} className="mt-12 first:mt-0">
            <H2 id={s.id}>{s.title}</H2>
            {s.body}
          </section>
        ))}
      </Prose>
      {/* Wide screens only: on a phone the list would push the answers below the fold. */}
      <aside className="hidden lg:block">
        <nav aria-label="On this page" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card lg:sticky lg:top-6">
          <p className="text-[13px] font-extrabold text-ch-ink-2">On this page</p>
          <ul className="mt-2 grid">
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="flex min-h-11 items-center text-[15px] text-ch-ink underline-offset-2 hover:underline">{s.title}</a></li>
            ))}
          </ul>
          {aside}
        </nav>
      </aside>
    </div>
  );
}

function supportSections(visitor: Visitor) {
  return [
    { id: "what", title: "What CampHawk does", body: <P>Searching live campground availability is free and needs no account. If the dates you want are already booked, you can set a <strong className="font-bold text-ch-ink">watch</strong>: we check that campground every 15 seconds, around the clock, and alert you the moment someone cancels — usually within seconds. You book on the official reservation site; CampHawk is not affiliated with Recreation.gov, ReserveCalifornia, or any state park system.</P> },
    { id: "no-alert", title: "I didn’t get an alert", body: <>
      <P>Work down this list — it’s almost always one of these:</P>
      <Ul items={[
        <><strong className="font-bold text-ch-ink">Check the watch is still active.</strong> Open <A href={ROUTES.watches} visitor={visitor}>Watches</A>. A paused watch, or one past its dates, no longer checks anything.</>,
        <><strong className="font-bold text-ch-ink">Check your email spam folder.</strong> Email alerts always send; they occasionally get filtered. Add our sending address to your contacts.</>,
        <><strong className="font-bold text-ch-ink">Text alerts need your number saved.</strong> <A href={ROUTES.settings} visitor={visitor}>Settings</A> → How we reach you. Entering the number and agreeing to the consent box is what turns texts on; nothing else does.</>,
        <><strong className="font-bold text-ch-ink">Push needs permission.</strong> In the app, check CampHawk is allowed to send notifications in your phone’s settings. We only ask after your first watch exists, so it’s easy never to have been asked.</>,
        <><strong className="font-bold text-ch-ink">Nobody canceled.</strong> The unglamorous answer. A popular weekend can go its whole run with no cancellation — we alert when one happens, we can’t make one happen.</>,
      ]} />
      <P>If none of that explains it, email us with the campground and dates and we will look at the actual alert log for your watch.</P>
    </> },
    { id: "texts", title: "Text messages", body: <P>Texts are optional and always have been — you’re never required to give a number to use CampHawk. Turn them on in Settings by entering your number and agreeing to the consent box, and off again with <strong className="font-bold text-ch-ink">Turn off</strong> beside your number. Reply <strong className="font-bold text-ch-ink">STOP</strong> to any message to stop them immediately. Message and data rates may apply.</P> },
    { id: "auto-cart", title: "Auto-cart and 8 AM holds", body: <><P>For Recreation.gov campgrounds we can add an opening straight to your cart, so you only have to check out. It works only there, because other reservation systems tie the cart to a browser session that can’t reach your phone. You connect your Recreation.gov login once; those credentials are stored encrypted on a private machine we run and <strong className="font-bold text-ch-ink">never reach CampHawk’s web servers or database</strong>. You can turn auto-cart off at any time in Settings.</P><P>ReserveCalifornia gets something different: an 8 AM hold, where we cart a released site and hand it to you. It’s invite-only for now; <A href={ROUTES.autoCart} visitor={visitor}>how holds work</A>.</P></> },
    { id: "subscription", title: "Managing your subscription", body: <>
      <P>Searching is free forever. Watching a booked campground and auto-cart come with a subscription; email and text alerts need a free account. <strong className="font-bold text-ch-ink">Where you manage it depends on where you started it.</strong></P>
      <Ul items={[
        <>Started on <A href={ROUTES.home} visitor={visitor}>camphawk.app</A>: open Settings → Subscription → Manage subscription, on the website or in the app.</>,
        // Hidden inside the iPhone app (Apple 2.3.10: no naming other mobile platforms).
        ...(visitor === "app" ? [] : [<>Started inside the <strong className="font-bold text-ch-ink">Android app</strong>: Google Play holds it. Settings → Subscription in the app opens Play for you, or go to the Play Store → Payments and subscriptions.</>]),
        <>Started inside the <strong className="font-bold text-ch-ink">iPhone app</strong>: Apple holds it. Settings → Subscription in the app opens the App Store for you, or go to Settings → your name → Subscriptions on the phone.</>,
      ]} />
      <P>Canceling stops future charges whichever of the three it is, and you keep access until the period you have already paid for ends. If you’re not sure which one you have, email us and we’ll look it up.</P>
    </> },
    { id: "delete", title: "Deleting your account", body: <P>Settings → <strong className="font-bold text-ch-ink">Delete account</strong>. This removes your watches, alert history and saved campgrounds permanently, and it can’t be undone. A subscription billed by CampHawk on camphawk.app is <strong className="font-bold text-ch-ink">canceled immediately</strong>; one bought in the App Store or Google Play is not, so cancel it there first. Either way, the rest of a period you have already paid for is not refunded. Delete the account only when that is what you want; to simply stop paying, cancel from wherever your subscription is managed (above) and keep your watches.</P> },
    { id: "where", title: "Where CampHawk works", body: <P>Every Recreation.gov campground in all 50 states, state parks in {COVERAGE.stateParkStates} states, and in Canada, Parks Canada plus the provincial and territorial parks of Ontario, British Columbia, Manitoba, Nova Scotia, Newfoundland and Labrador, Yukon and the Northwest Territories. That’s {SOURCE_COUNT} official sources in all, each named on our <A href={ROUTES.sources} visitor={visitor}>data sources</A> page. If a campground you want is missing, email us — adding a system is work we do based on what people ask for.</P> },
    { id: "contact", title: "Contact", body: <P><Mail />. Also see our <A href={ROUTES.terms} visitor={visitor}>Terms</A> and <A href={ROUTES.privacy} visitor={visitor}>Privacy Policy</A>.</P> },
  ];
}

export function Support() {
  return (
    <LabPage page="Support" title="CampHawk Support" dock={false} wide photo={{ art: ART.s1, pos: "78% 60%", posLg: "50% 62%" }}
      sub={<>Email <a href={`mailto:${EMAIL}`} className="font-bold text-ch-paper underline underline-offset-[3px]">{EMAIL}</a> and a human will answer. Most questions are below.</>}
      controls={({ visitor }) => visitor === "app" ? <span className="text-[13px]">In the app: the Android line is hidden (Apple 2.3.10)</span> : null}
    >
      {({ visitor }) => <Sections sections={supportSections(visitor)} />}
    </LabPage>
  );
}

export function Sources() {
  return (
    <LabPage page="Data sources" title="Where CampHawk’s information comes from" dock={false} wide photo={{ art: ART.c1, pos: "60% 60%", posLg: "50% 55%" }}>
      {() => (
        <WithRail toc={[["how", "How the data is obtained"], ["official", "Official sources"], ["portals", "Additional portals"], ["accuracy", "Accuracy"], ["questions", "Questions"]]}>
        <Prose>
          {/* First and unmissable: Google Play rejected the listing when this sat at the bottom. */}
          <Callout title="CampHawk is not a government app." className="mt-0 border-ch-ink-2">{AFFILIATION_DISCLAIMER}</Callout>
          <H2 id="how" className="mt-12">How the data is obtained</H2>
          <P>CampHawk does not create campground or availability information. It reads what the official reservation systems below publish, and shows it to you unchanged. When a campsite opens up, CampHawk sends you to that same official site to book it — every reservation, payment and cancellation happens there, under that agency’s terms, not CampHawk’s.</P>
          <H2 id="official">Official sources</H2>
          {/* One compact list, the same rows as the portals below (round 12: 14 padded cards made the
              longest page in the lab for the least information). */}
          <ul className="mt-5 divide-y divide-ch-line rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card">
            {DATA_SOURCES.map((s) => (
              <li key={s.key} className="px-5 py-3.5">
                <span className="grid gap-0.5 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ch-forest underline decoration-1 underline-offset-[3px] hover:decoration-2">{s.name}<span className="sr-only"> (opens in a new tab)</span></a>
                  <span className="text-[14px] text-ch-muted [overflow-wrap:anywhere] sm:shrink-0 sm:whitespace-nowrap">{s.url.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                </span>
                <span className="mt-0.5 block text-[15px] text-ch-ink-2">{s.coverage}</span>
              </li>
            ))}
          </ul>
          <H2 id="portals">Additional official portals</H2>
          <P>Some of the sources above serve more than one state or province, or publish through a separate open-data service. Those portals are:</P>
          <ul className="mt-4 divide-y divide-ch-line rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card">
            {ADDITIONAL_PORTALS.map((p) => (
              <li key={p.url} className="grid gap-0.5 px-5 py-3 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ch-forest underline decoration-1 underline-offset-[3px] hover:decoration-2">{p.name}<span className="sr-only"> (opens in a new tab)</span></a>
                <span className="text-[14px] text-ch-muted [overflow-wrap:anywhere] sm:shrink-0 sm:whitespace-nowrap">{p.url.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
              </li>
            ))}
          </ul>
          <H2 id="accuracy">Accuracy</H2>
          <P>Availability changes constantly and CampHawk can only report what a reservation system told it at the time it last checked. The official site linked from every campground page and every alert is always the authority. If the two disagree, the official site is correct.</P>
          <H2 id="questions">Questions</H2>
          <P>Email <Mail /> and a human will answer.</P>
        </Prose>
        </WithRail>
      )}
    </LabPage>
  );
}

export function SmsOptIn() {
  return (
    <LabPage page="SMS opt-in" title="Text Alert Opt‑In (optional)" dock={false}>
      {({ visitor }) => (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start lg:gap-14">
          <Prose>
            <P>This is the optional SMS opt-in form shown to signed-in users. It appears in two places and is the same form in both: in account settings at camphawk.app/settings, and on the optional welcome step shown once after an account is created. It is <strong className="font-bold text-ch-ink">never</strong> part of subscription or checkout, and it is <strong className="font-bold text-ch-ink">never required</strong> to create an account, subscribe, or use any feature — the welcome step has a Skip button and no field on it is mandatory. Text alerts are a separate, voluntary add-on: a user must deliberately type their number and tick the unchecked consent box before any text is sent. Users can skip this entirely and continue using every CampHawk feature with email alerts only.</P>
          </Prose>
          <div>
            <div className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-6">
              <SmsAlerts demo visitor={visitor} />
            </div>
            <p className="mt-3 px-1 text-[14px] leading-relaxed text-ch-ink-2">Prefer not to receive texts? Simply leave this form blank — no phone number is stored and you keep full access to search, watches, and email alerts.</p>
          </div>
        </div>
      )}
    </LabPage>
  );
}

const PRIVACY = (visitor: Visitor) => [
  { id: "collect", title: "What we collect", body: <>
    <P>You can search campground availability without giving us anything. What we collect depends on what you choose to use:</P>
    <Ul items={[
      <><strong className="font-bold text-ch-ink">Using the app without an account.</strong> The app gives your device a random identifier so it can keep your watches and any subscription you buy. We never ask for your name, email address or phone number to do this.</>,
      <><strong className="font-bold text-ch-ink">A free account (optional).</strong> If you create one, we collect your email address. If you choose to receive text alerts, we also collect the mobile phone number you provide.</>,
      <><strong className="font-bold text-ch-ink">Your watches and favorites.</strong> The campgrounds, dates and preferences you save, so we can check them for you.</>,
      <><strong className="font-bold text-ch-ink">Push notifications.</strong> If you allow notifications, a push token for your device, so alerts reach it.</>,
      <><strong className="font-bold text-ch-ink">Purchases.</strong> Whether you have a subscription, which plan, and the transaction reference from your app store or Stripe. We never receive your card details.</>,
      <><strong className="font-bold text-ch-ink">Location.</strong> An approximate location from your network to center your first search, and your precise location only if you tap to search near you. Neither is stored.</>,
      <><strong className="font-bold text-ch-ink">Diagnostics.</strong> Crash and performance reports, so we can fix problems.</>,
      <><strong className="font-bold text-ch-ink">Abuse prevention.</strong> When the app creates a new identifier, we keep a one-way hash of your network address for one hour to limit automated sign-ups, then delete it.</>,
    ]} />
    <P>On the website, we also record which main steps of CampHawk your account has reached (for example running a search, opening a campground page, or viewing our plans) and when, so we can see where people get stuck. We record only the step, not what you searched for.</P>
    <P>We do not use your data for advertising, we do not track you across other apps or websites, and we do not sell it.</P>
  </> },
  { id: "use", title: "How we use it", body: <P>We use this information only to run CampHawk: to check the campgrounds you watch, to deliver the alerts you ask for, to provide the subscription you bought, and to keep the service working. Your email and phone number are used solely to deliver the campsite availability alerts you request and to operate your account. We do not send marketing messages.</P> },
  { id: "texting", title: "Text messaging", body: <>
    <P>Text alerts are strictly opt-in: you receive them only if you enter your mobile number in your account settings. Message frequency varies with campsite availability — typically at most one message per campground watch. <strong className="font-bold text-ch-ink">Message and data rates may apply.</strong> Reply <strong className="font-bold text-ch-ink">STOP</strong> to any message to opt out, or remove your number in account settings at any time. Reply <strong className="font-bold text-ch-ink">HELP</strong> for help.</P>
    <P><strong className="font-bold text-ch-ink">No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong> Mobile numbers and text-messaging originator opt-in data and consent are not shared with any third parties, except for our SMS delivery provider (Twilio) solely to send the messages you requested.</P>
  </> },
  { id: "sharing", title: "Sharing", body: <P>We do not sell or share your personal information. Data is processed by the service providers that run CampHawk solely to provide the service: hosting (Vercel and Fly.io), database (Supabase), sign-in (Clerk), email (Resend), text messages (Twilio), push notifications (Firebase Cloud Messaging), payments (the app stores, Stripe and RevenueCat), maps and place search (Mapbox), and crash reporting (Sentry). Each of them may use it only to provide their service to us, and must protect it at least as carefully as this policy does.</P> },
  { id: "keeping", title: "Keeping and deleting your data", body: <>
    <P>We keep your information for as long as you use CampHawk. You can remove your phone number, turn off email alerts, or delete watches at any time. To delete everything, go to <A href={ROUTES.settings} visitor={visitor}>Settings</A> in the app or on the website and choose <strong className="font-bold text-ch-ink">Delete account</strong> (or <strong className="font-bold text-ch-ink">Delete my data</strong> if you use the app without an account). This removes your watches, alert history, saved campgrounds and account from our systems right away. You can also ask us to delete it by emailing <Mail />.</P>
    <P>Deleting your data does not cancel a subscription bought through an app store. Cancel it in your store account settings.</P>
  </> },
  { id: "contact", title: "Contact", body: <P>Questions: <Mail /></P> },
];

const TERMS = (visitor: Visitor) => [
  { id: "service", title: "The service", body: <P>CampHawk (camphawk.app) helps you find campsite availability across US public lands, US state parks, and national, provincial and territorial parks in Canada, and alerts you by email and (optionally) text message when a campground you watch becomes available. CampHawk is not affiliated with Recreation.gov, ReserveCalifornia, the National Park Service, Parks Canada, or any state, provincial or territorial park agency. All bookings happen on the official reservation sites.</P> },
  { id: "guarantees", title: "No guarantees", body: <P>Availability data comes from third-party reservation systems and can change at any moment. Alerts are best-effort: a site may already be taken by the time you act, and we cannot guarantee delivery timing of any notification. CampHawk is provided “as is” without warranties of any kind.</P> },
  { id: "texts", title: "Text alerts", body: <P>Text alerts are <strong className="font-bold text-ch-ink">optional and separate from these Terms</strong> — agreeing to this Terms of Service does <strong className="font-bold text-ch-ink">not</strong> opt you into text messages, and SMS consent is never required to create an account, subscribe, or use any CampHawk feature. You opt in only by deliberately entering your number and checking the consent box in your account settings. Message frequency varies with campsite availability. Message and data rates may apply. Reply STOP to opt out or HELP for help. See our <A href={ROUTES.privacy} visitor={visitor}>Privacy Policy</A> for how your number is handled.</P> },
  { id: "subscriptions", title: "Subscriptions", body: <P>Some features require a paid subscription, billed through Stripe. You can cancel any time via the “Manage subscription” option; access continues through the end of the paid period.</P> },
  { id: "use", title: "Acceptable use", body: <P>Don’t abuse the service, attempt to disrupt it, or use it to violate the terms of the underlying reservation systems.</P> },
  { id: "contact", title: "Contact", body: <P>Questions: <Mail /></P> },
];

export function Privacy() {
  return (
    <LabPage page="Privacy" title="CampHawk Privacy Policy" sub="Last updated: October 5, 2026" dock={false} wide>
      {/* CampHawk's published policy, word for word; the note flags what it says that the product
          doesn't (round 14). For the owner, not for this lab to reword. */}
      {({ visitor }) => <Sections sections={PRIVACY(visitor)} aside={<LabNote className="mt-4">CampHawk’s published text, as is. Two gaps for the owner: it says email alerts can be turned off (Settings has email always on), and it doesn’t mention the saved Recreation.gov login that auto-cart keeps.</LabNote>} />}
    </LabPage>
  );
}

export function Terms() {
  return (
    <LabPage page="Terms" title="CampHawk Terms of Service" sub="Last updated: September 30, 2026" dock={false} wide>
      {({ visitor }) => <Sections sections={TERMS(visitor)} aside={<LabNote className="mt-4">CampHawk’s published text, as is. Its billing line predates app-store billing (see Support).</LabNote>} />}
    </LabPage>
  );
}
