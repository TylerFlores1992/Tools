"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Loader2, Star } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { Collapsible } from "../../ui/Collapsible";
import { AUTOCART_FEATURES, BASE_FEATURES } from "../../Pricing";
import { WATCH_LIMIT, pricePhrase, priceShort, yearlySavingPercent, type Visitor, type PlanTier } from "../../data";
import { LIMITS } from "../../copy";
import { ART } from "../Art";
import { LabSelect, type Plan } from "../AppParts";
import { BetaNote } from "../BareFrame";
import { ROUTES } from "../gates";
import { A, LabNote, Steps } from "../LabPage";
import { LabPage } from "../LabPage";
import { useUrlState, withVisitor } from "../labState";
import { HOLD_STEPS, LAUNCH_PRICING, RC_HOLD_OPEN, TRIAL_DAYS } from "./tier2-data";

// Tier 2: Plans & pricing (campsite-finder src/app/(app)/pricing, PricingSection.tsx, Pricing.tsx,
// StorePaywall.tsx, RcHoldExplainer.tsx). The one place that sells. What it keeps on purpose:
// - No monthly/yearly toggle: each card shows the monthly price big, the yearly under it.
// - "Launch pricing … while we’re new": no countdown, no struck-through "was" price.
// - A subscriber is never sold to: they get what they can do, and an Alerts subscriber one
//   upgrade that goes to Settings (prorated in place), never a second checkout.
// - In the app: no web prices, only the store's own, with Restore purchases, renewal terms and
//   the Terms and Privacy links the stores require. A failed lookup never sells.
// - A past subscriber isn't offered a second trial; a failed lookup says so.
// - The caveat on 8am holds sits before the decision, not under the promise.
// Lab changes, from CampHawk's own rules:
// - The page isn't tinted green (decoration); ticks are ink; step numbers are neutral.
// - Stripe checkout is an ink account step, like the trial (CampHawk's are green; blue is kept for
//   booking providers).
// - "Start 7‑day free trial" carries the plan into sign-up, so you come back to it.
// - The 8am hold explainer says the beta is closed (it has been since Sep 22, 2026; CampHawk's
//   page still offers it).

type Lookup = "ok" | "failed";
type Checkout = "works" | "fails";
type Store = "sells" | "cant";

const plainNights = (f: string) => f.replace("any N nights in a window", "how many nights you need, anywhere in a window");
const priceLabel = (t: PlanTier, i: "monthly" | "yearly") => priceShort(t, i).replace("/mo", " / month").replace("/yr", " / year");

function PlanCard({ name, tier, features, recommended, children }: { name: string; tier: PlanTier; features: string[]; recommended?: boolean; children: ReactNode }) {
  return (
    <div className={cx("relative flex flex-col rounded-ch-card bg-ch-card p-6 shadow-ch-pop sm:p-8", recommended ? "border border-ch-forest ring-1 ring-ch-forest" : "border border-ch-line")}>
      {/* The badge sits on the card's top edge, so both cards start their title at the same
          height without an empty slot in the other one. */}
      {recommended && <p className="absolute -top-3.5 left-6 inline-flex items-center gap-1.5 rounded-full border border-ch-forest bg-ch-card px-3 py-1 text-[13px] font-bold text-ch-forest sm:left-8"><Star aria-hidden="true" className="size-3.5" />Best chance to book</p>}
      <h3 className="font-ch-display text-[24px] font-extrabold tracking-[-.02em] text-ch-forest">{name}</h3>
      <p className="mt-3 font-ch-display text-[40px] font-extrabold leading-none tracking-[-.03em] text-ch-ink tabular-nums">{priceShort(tier, "monthly")}</p>
      <p className="mt-2 text-[15px] text-ch-ink-2">or {priceShort(tier, "yearly")}, save {yearlySavingPercent(tier)}%</p>
      <ul className="mt-5 grid gap-2.5 border-t border-ch-line pt-5">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 text-[16px] leading-snug text-ch-ink-2">
            <Check aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-ch-ink" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap gap-2 pt-6">{children}</div>
    </div>
  );
}

/** The web pitch and the two plan cards, for anyone without a subscription. */
function WebPlans({ visitor, lookup, checkout }: { visitor: Visitor; lookup: Lookup; checkout: Checkout }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const signedOut = visitor === "signed-out";
  const go = (id: string) => {
    setBusy(id);
    setError(false);
    window.setTimeout(() => { setBusy(null); if (checkout === "fails") setError(true); }, 900);
  };
  const priceBtn = (tier: PlanTier, i: "monthly" | "yearly") => {
    const id = `${tier}-${i}`;
    return (
      <button key={id} type="button" disabled={busy !== null} onClick={() => go(id)} aria-label={visitor === "lapsed" ? undefined : `Start ${TRIAL_DAYS}‑day free trial: ${tier === "autocart" ? "Auto-Cart" : "Alerts"}, then ${priceShort(tier, i)}`} className={buttonClasses({ variant: tier === "autocart" ? "ink" : "quiet", className: "min-h-12 px-5 disabled:cursor-wait" })}>
        {busy === id && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{visitor === "lapsed" ? priceLabel(tier, i) : `Start ${TRIAL_DAYS}‑day free trial`}
      </button>
    );
  };
  // One button per card (monthly), and yearly as a quieter text choice beside it: four equal
  // price buttons made the pick harder than it is (round 8).
  const yearlyBtn = (tier: PlanTier) => {
    const id = `${tier}-yearly`;
    return (
      <button key={id} type="button" disabled={busy !== null} onClick={() => go(id)} aria-label={`Pay yearly instead: ${tier === "autocart" ? "Auto-Cart" : "Alerts"}, ${priceShort(tier, "yearly")}`} className="inline-flex min-h-12 cursor-pointer items-center gap-2 px-1 text-[15px] font-bold text-ch-ink underline underline-offset-[3px] hover:decoration-2 disabled:cursor-wait">
        {busy === id && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}Pay yearly instead
      </button>
    );
  };
  const trial = (tier: PlanTier) => (
    <Link href={withVisitor(`${ROUTES.signUp}?plan=${tier}`, visitor)} className={buttonClasses({ variant: tier === "autocart" ? "ink" : "quiet", className: "min-h-12 px-5" })}>Start {TRIAL_DAYS}‑day free trial</Link>
  );
  const foot = lookup === "failed" && !signedOut
    ? "We couldn’t check your current plan just now."
    : visitor === "lapsed"
      ? "Prices in US dollars, billed monthly or yearly."
      : `Prices in US dollars. Free for ${TRIAL_DAYS} days, then billed monthly or yearly; cancel before then and you’re never charged.`;
  return (
    <section aria-labelledby="pitch">
      {/* The plans are the page: they rise into the band on their own, one card level, with the
          terms read beside them on paper below. */}
      <h2 id="pitch" className="sr-only">Plans</h2>
      <div className="grid gap-8 md:grid-cols-2 md:gap-6">
        <PlanCard name="Alerts" tier="base" features={BASE_FEATURES.map(plainNights)}>
          {signedOut ? trial("base") : [priceBtn("base", "monthly"), yearlyBtn("base")]}
        </PlanCard>
        <PlanCard name="Auto-Cart" tier="autocart" features={AUTOCART_FEATURES} recommended>
          {signedOut ? trial("autocart") : [priceBtn("autocart", "monthly"), yearlyBtn("autocart")]}
        </PlanCard>
      </div>
      <p role="status" className="sr-only">{busy ? "Opening checkout…" : ""}</p>
      {error && <p role="alert" className="mt-4 text-[15px] font-bold text-ch-alert-deep">We couldn’t open checkout just now. Nothing was charged. Try again.</p>}
      {/* One block of terms under the plans (two uneven columns, one repeating the band, read as
          leftovers). */}
      <div className="mx-auto mt-8 max-w-[64ch] text-[16px] leading-relaxed text-ch-ink-2 sm:text-center">
        <p className="font-bold text-ch-ink">Cancel any time. Live search keeps working either way.</p>
        <p className="mt-1.5">{LAUNCH_PRICING}</p>
        <p className="mt-1.5 text-[15px]">{foot}</p>
      </div>
    </section>
  );
}

/** A subscriber: what they can do, never a pitch. */
function AllSet({ visitor, plan, phone }: { visitor: Visitor; plan: Plan; phone: boolean }) {
  const autocart = plan === "autocart";
  const items = [
    `Run up to ${WATCH_LIMIT} watches at once. We check each one every 15 seconds, around the clock.`,
    phone ? "Alerts reach you by text as well as email. Change the number any time in Settings." : "Add your number in Settings so alerts reach you by text as well as email — a text is what actually wakes you at 6 AM.",
    autocart ? "Auto-cart is connected, so an opening on a Recreation.gov watch goes straight into your cart while you get to your phone." : "With the Auto-Cart plan, an opening goes straight into your Recreation.gov cart while you get to your phone — add it in Settings.",
    "Any alert lets you pause the watch, reopen it, or mute a site you don’t want.",
  ];
  return (
    <section aria-labelledby="allset" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-9">
      <h2 id="allset" className="font-ch-display text-[clamp(26px,3.2vw,38px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ch-forest">You’re all set — here’s what you can do</h2>
      <ul className="mt-5 grid max-w-[62ch] gap-3 text-[17px] leading-relaxed text-ch-ink-2">
        {items.map((it) => <li key={it} className="flex gap-3"><Check aria-hidden="true" className="mt-1 size-4.5 shrink-0 text-ch-ink" /><span>{it}</span></li>)}
      </ul>
      <div className="mt-7 flex flex-wrap gap-2.5">
        {!autocart && <Link href={withVisitor(`${ROUTES.settings}?plan=alerts`, visitor)} className={buttonClasses({ variant: "ink", className: "min-h-12 px-5" })}>Upgrade to Auto-Cart — {priceShort("autocart", "monthly")}</Link>}
        <Link href={withVisitor(ROUTES.newWatch, visitor)} className={buttonClasses({ variant: autocart ? "primary" : "quiet", className: "min-h-12 px-5" })}>New watch</Link>
        <Link href={withVisitor(ROUTES.settings, visitor)} className={buttonClasses({ variant: "quiet", className: "min-h-12 px-5" })}>Alert settings</Link>
      </div>
    </section>
  );
}

/** The app, not subscribed: the store's own paywall, or a sentence where the store can't sell. */
function AppPaywall({ store }: { store: Store }) {
  const [buying, setBuying] = useState<string | null>(null);
  const [restore, setRestore] = useState<"idle" | "busy" | "none">("idle");
  const tiles = [
    { id: "base-m", title: "Alerts, monthly", tier: "base" as const, i: "month" },
    { id: "base-y", title: "Alerts, yearly", tier: "base" as const, i: "year" },
    { id: "ac-m", title: "Auto-Cart, monthly", tier: "autocart" as const, i: "month" },
    { id: "ac-y", title: "Auto-Cart, yearly", tier: "autocart" as const, i: "year" },
  ];
  return (
    <section aria-labelledby="app-pay" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-9">
      <h2 id="app-pay" className="font-ch-display text-[clamp(24px,3vw,34px)] font-extrabold leading-[1.1] tracking-[-.02em] text-ch-forest">Searching is free. Watching needs a subscription.</h2>
      {/* A guest has no email or number, so the channels aren't promised. */}
      <p className="mt-3 max-w-[62ch] text-[17px] leading-relaxed text-ch-ink-2">A subscription covers up to {WATCH_LIMIT} watches at once, with an alert the moment a site opens; the Auto-Cart plan adds automatic carting on Recreation.gov. Live search keeps working either way.</p>
      {store === "cant" ? (
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ch-ink-2">Subscriptions are managed at camphawk.app. Once yours is active, everything works here.</p>
      ) : (
        <>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {tiles.map((t) => (
              <li key={t.id} className="flex flex-col rounded-ch-input border border-ch-line bg-ch-paper p-4">
                <p className="text-[16px] font-bold text-ch-ink">{t.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ch-ink-2">{t.tier === "base" ? `Run up to ${WATCH_LIMIT} watches around the clock, with an alert the moment a site opens.` : "Everything in Alerts, plus Auto-Cart: on Recreation.gov an opening goes straight into your cart."}</p>
                <p className="mt-1 flex-1 text-[13px] text-ch-ink-2">{TRIAL_DAYS} days free, then {t.i === "month" ? priceShort(t.tier, "monthly").replace("/mo", "") : priceShort(t.tier, "yearly").replace("/yr", "")} per {t.i}. Renews automatically.</p>
                <button type="button" disabled={buying !== null} onClick={() => { setBuying(t.id); window.setTimeout(() => setBuying(null), 1200); }} className={buttonClasses({ variant: t.tier === "autocart" ? "ink" : "quiet", fullWidth: true, className: "mt-4 min-h-12 disabled:cursor-wait" })}>
                  {buying === t.id ? "Opening…" : `Start ${TRIAL_DAYS}‑day free trial, then ${t.i === "month" ? priceShort(t.tier, "monthly").replace("/mo", "/month") : priceShort(t.tier, "yearly").replace("/yr", "/year")}`}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" disabled={restore === "busy"} onClick={() => { setRestore("busy"); window.setTimeout(() => setRestore("none"), 900); }} className={buttonClasses({ variant: "quiet", fullWidth: true, className: "mt-4 min-h-12" })}>{restore === "busy" ? "Restoring…" : "Restore purchases"}</button>
          <p role="status" className="mt-2 text-[14px] text-ch-ink-2">{restore === "none" ? "We didn’t find an active subscription for this Apple ID." : ""}</p>
          <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed text-ch-ink-2">No account needed — your alerts come to this device as notifications. A free account is optional: it adds email and text alerts and lets you use your subscription on the website and your other devices. <A href={ROUTES.signUp} visitor="app">Create an account</A> or <A href={ROUTES.signIn} visitor="app">sign in</A>, any time.</p>
          <p className="mt-3 max-w-[70ch] text-[13px] leading-relaxed text-ch-ink-2">Payment is charged to your Apple ID account at confirmation of purchase. The subscription renews automatically unless it is canceled at least 24 hours before the end of the current period, and your account is charged for renewal within 24 hours before the end of the current period. Manage or cancel any time in your App Store account settings. Any unused portion of a free trial is forfeited when you buy a subscription.</p>
          <p className="mt-2 text-[13px] text-ch-ink-2"><A href="#">Terms of Use</A> · <A href={ROUTES.privacy} visitor="app">Privacy Policy</A></p>
        </>
      )}
    </section>
  );
}

function HoldExplainer() {
  const steps = (
    <Steps steps={[
      "Someone cancels, and the site waits for the next 8 AM release. There’s nothing to switch on.",
      "You get an alert naming the site, the nights and the release time, with a “Hold it for me” button. Nothing happens unless you tap it: holding a site takes it off the market for everyone else, so there’s no standing setting for it.",
      "Within seconds of the release, we put the site in a cart, before most people have found the page.",
      "Open the claim link, sign in to ReserveCalifornia, and we hand it over. You do the booking and the paying; we never do either.",
    ].map((body, i) => [`${HOLD_STEPS[i][0]}: ${HOLD_STEPS[i][1].toLowerCase()}`, body] as const)} />
  );
  return (
    <section aria-labelledby="rc-hold" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-8">
      {/* Wide screens: the story on the left, the steps beside it (the card was half empty with the
          steps folded away). Narrow screens fold the steps into a collapsible under the story. */}
      <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 id="rc-hold" className="text-balance font-ch-display text-[22px] font-extrabold leading-tight text-ch-ink">California 8 AM releases: we can hold the site while you wake up</h2>
          <div className="mt-4 text-[16px] leading-relaxed text-ch-ink-2">
            <p>When somebody cancels a ReserveCalifornia booking, the site usually doesn’t go back on sale straight away. It’s released at 8 AM the next morning, and it can be gone in seconds. Because we can see the release time the night before, we can tell you what’s coming and offer to be there when it opens.</p>
            <BetaNote className="mt-4 border-t border-ch-line pt-4" extra="Everyone’s ReserveCalifornia watches still alert as usual." />
            <div className="lg:hidden">{RC_HOLD_OPEN ? steps : <Collapsible label="How a hold works" className="mt-5">{steps}</Collapsible>}</div>
            <p className="mt-5 text-[15px]">ReserveCalifornia parks only. On Recreation.gov, auto-cart is open to every Auto-Cart subscriber: connect once and openings go straight into your cart.</p>
          </div>
        </div>
        <div className="hidden lg:block">
          <h3 className="text-[17px] font-bold text-ch-ink">How a hold works</h3>
          <div className="text-[16px] leading-relaxed text-ch-ink-2">{steps}</div>
        </div>
      </div>
    </section>
  );
}

export function PricingPage() {
  const [lookup, setLookup] = useUrlState<Lookup>("lookup", "ok", ["ok", "failed"]);
  const [checkout, setCheckout] = useUrlState<Checkout>("checkout", "works", ["works", "fails"]);
  const [store, setStore] = useUrlState<Store>("store", "sells", ["sells", "cant"]);
  const [phone, setPhone] = useUrlState<"saved" | "none">("sms", "none", ["saved", "none"]);
  return (
    <LabPage
      page="Plans & pricing"
      tab="pricing"
      title="Plans & pricing"
      sub={({ visitor }) => visitor === "subscriber"
        ? "Your plan, what it does for you, and what we never do."
        // No price in the app (store rule): the store's own tiles below carry it.
        : visitor === "app" ? "Your plan works in the app and on the web. Cancel any time from your store account."
        : <><span className="block text-balance font-ch-display text-[clamp(20px,2vw,26px)] font-extrabold leading-snug text-ch-paper">Searching is free. Watching starts at {pricePhrase("base", "monthly")}.</span><span className="mt-2 block">A subscription keeps a watch running around the clock, and Auto-Cart wins the sites that vanish in minutes.</span></>}
      photo={{ art: ART.p1, pos: "78% 60%", posLg: "50% 62%" }}
      showPlan
      controls={({ visitor }) => (
        <>
          {(visitor === "member" || visitor === "lapsed") && <LabSelect label="Plan lookup" short="Lookup" value={lookup} onChange={setLookup} options={[["ok", "Answered"], ["failed", "Failed"]]} />}
          {(visitor === "member" || visitor === "lapsed") && <LabSelect label="Checkout" short="Checkout" value={checkout} onChange={setCheckout} options={[["works", "Opens"], ["fails", "Fails"]]} />}
          {visitor === "app" && <LabSelect label="App store" short="Store" value={store} onChange={setStore} options={[["sells", "Can sell"], ["cant", "Can’t sell"]]} />}
          {visitor === "subscriber" && <LabSelect label="Text alerts" short="Texts" value={phone} onChange={setPhone} options={[["none", "No number"], ["saved", "Number saved"]]} />}
        </>
      )}
    >
      {({ visitor, plan }) => (
        <div className="grid gap-6">
          {visitor === "subscriber" ? <AllSet visitor={visitor} plan={plan} phone={phone === "saved"} />
            : visitor === "app" ? <><AppPaywall store={store} />{store === "sells" && <LabNote>The store tiles show CampHawk’s prices as stand-ins; the real tiles show the App Store’s own price strings.</LabNote>}</>
            : <WebPlans key={`${visitor}-${checkout}`} visitor={visitor} lookup={lookup} checkout={checkout} />}
          <HoldExplainer />
          {/* The limits read as three plain statements on paper, as on the home page: not a
              third card stretched to match the hold card's height. */}
          <section aria-labelledby="dont" className="mt-4 grid gap-x-10 gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <h2 id="dont" className="font-ch-display text-[clamp(24px,2.6vw,30px)] font-extrabold leading-[1.15] tracking-[-.02em] text-ch-forest">What we don’t do</h2>
              <p className="mt-2 max-w-[36ch] text-[16px] leading-relaxed text-ch-ink-2">The limits, plainly, so you know what you’re paying for before you pay.</p>
            </div>
            <ul className="border-t border-ch-line">
              {LIMITS.map((l) => <li key={l} className="border-b border-ch-line py-3.5 text-[17px] leading-relaxed text-ch-ink-2">{l}</li>)}
            </ul>
          </section>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ size: "lg", className: "px-6" })}>Search campgrounds free</Link>
            {visitor === "app" ? <A href={ROUTES.explore} visitor={visitor}>Back to search</A> : <A href={ROUTES.alerts} visitor={visitor}>How cancellation alerts work</A>}
          </div>
        </div>
      )}
    </LabPage>
  );
}
