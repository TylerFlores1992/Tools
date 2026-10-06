"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Info, Loader2, Star } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { Collapsible } from "../../ui/Collapsible";
import { AUTOCART_FEATURES, BASE_FEATURES } from "../../Pricing";
import { WATCH_LIMIT, pricePhrase, priceShort, yearlySavingPercent, type Visitor, type PlanTier } from "../../data";
import { LIMITS } from "../../copy";
import { ART } from "../Art";
import { LabSelect, type Plan } from "../AppParts";
import { ROUTES } from "../gates";
import { A, Callout, LabNote, Steps } from "../LabPage";
import { LabPage } from "../LabPage";
import { useUrlState, withVisitor } from "../labState";
import { HOLD_MINUTES, RC_HOLD_CLOSED_ON, RC_HOLD_OPEN, TRIAL_DAYS } from "./tier2-data";

// Tier 2: Plans & pricing (campsite-finder src/app/(app)/pricing, PricingSection.tsx, Pricing.tsx,
// StorePaywall.tsx, RcHoldExplainer.tsx). The one place that sells. What it keeps on purpose:
// - No monthly/yearly toggle: each card shows the monthly price big, the yearly under it.
// - "Launch pricing … while we're new": no countdown, no struck-through "was" price.
// - A subscriber is never sold to: they get what they can do, and an Alerts subscriber one
//   upgrade that goes to Settings (prorated in place), never a second checkout.
// - In the app: no web prices, only the store's own, with Restore purchases, renewal terms and
//   the Terms and Privacy links the stores require. A failed lookup never sells.
// - A past subscriber isn't offered a second trial; a failed lookup says so.
// - The caveat on 8am holds sits before the decision, not under the promise.
// Lab changes, from CampHawk's own rules:
// - The page isn't tinted green (decoration); ticks are ink; step numbers are neutral.
// - Stripe checkout is the blue provider hand-off (CampHawk's are green).
// - "Start 7-day free trial" carries the plan into sign-up, so you come back to it.
// - The 8am hold explainer says the beta is closed (it has been since Sep 22, 2026; CampHawk's
//   page still offers it).

type Lookup = "ok" | "failed";
type Checkout = "works" | "fails";
type Store = "sells" | "cant";

const plainNights = (f: string) => f.replace("any N nights in a window", "how many nights you need, anywhere in a window");
const priceLabel = (t: PlanTier, i: "monthly" | "yearly") => priceShort(t, i).replace("/mo", " / month").replace("/yr", " / year");

function PlanCard({ name, tier, features, recommended, children }: { name: string; tier: PlanTier; features: string[]; recommended?: boolean; children: ReactNode }) {
  return (
    <div className={cx("flex flex-col rounded-[18px] bg-ch-card p-6 sm:p-7", recommended ? "border-2 border-ch-forest shadow-ch-card" : "border border-ch-line")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-ch-display text-[24px] font-extrabold tracking-[-.02em] text-ch-forest">{name}</h3>
        {recommended && <p className="inline-flex items-center gap-1.5 rounded-full bg-ch-forest px-3 py-1 text-[13px] font-bold text-ch-white"><Star aria-hidden="true" className="size-3.5" />Best chance to book</p>}
      </div>
      <p className="mt-3 font-ch-display text-[40px] font-extrabold leading-none tracking-[-.03em] text-ch-ink tabular-nums">{priceShort(tier, "monthly")}</p>
      <p className="mt-2 text-[15px] text-ch-ink-2">or {priceShort(tier, "yearly")} — save {yearlySavingPercent(tier)}%</p>
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
      <button key={id} type="button" disabled={busy !== null} onClick={() => go(id)} className={buttonClasses({ variant: tier === "autocart" ? "cart" : "quiet", className: "min-h-12 px-5 disabled:cursor-wait" })}>
        {busy === id && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{priceLabel(tier, i)}
      </button>
    );
  };
  const trial = (tier: PlanTier) => (
    <Link href={withVisitor(`${ROUTES.signUp}?plan=${tier}`, visitor)} className={buttonClasses({ variant: tier === "autocart" ? "ink" : "quiet", className: "min-h-12 px-5" })}>Start {TRIAL_DAYS}-day free trial</Link>
  );
  const foot = lookup === "failed" && !signedOut
    ? "We couldn't check your current plan just now."
    : visitor === "lapsed"
      ? "Prices in US dollars, billed monthly or yearly."
      : `Prices in US dollars. Free for ${TRIAL_DAYS} days, then billed monthly or yearly; cancel before then and you're never charged.`;
  return (
    <section aria-labelledby="pitch" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-9">
      {/* Headline left, the terms beside it on wide screens (as the home page's pricing block). */}
      <div className="grid gap-x-10 gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[.1em] text-ch-ink-2">Launch pricing</p>
          <h2 id="pitch" className="mt-2 max-w-[24ch] font-ch-display text-[clamp(26px,3.2vw,38px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ch-forest">Searching is free. Watching starts at {pricePhrase("base", "monthly")}.</h2>
        </div>
        <div className="grid gap-2 text-ch-ink-2">
          <p className="text-[17px] font-bold leading-relaxed text-ch-ink">Cancel any time. Live search keeps working either way.</p>
          <p className="text-[15px] leading-relaxed">This rate goes up as we add campgrounds and states. Subscribe now and you keep it for as long as your subscription runs.</p>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <PlanCard name="Alerts" tier="base" features={BASE_FEATURES.map(plainNights)}>
          {signedOut ? trial("base") : [priceBtn("base", "monthly"), priceBtn("base", "yearly")]}
        </PlanCard>
        <PlanCard name="Auto-Cart" tier="autocart" features={AUTOCART_FEATURES} recommended>
          {signedOut ? trial("autocart") : [priceBtn("autocart", "monthly"), priceBtn("autocart", "yearly")]}
        </PlanCard>
      </div>
      <p role="status" className="sr-only">{busy ? "Opening checkout…" : ""}</p>
      {error && <p role="alert" className="mt-4 text-[15px] font-bold text-ch-alert-deep">We couldn&apos;t open checkout just now. Nothing was charged — try again.</p>}
      <p className="mt-5 max-w-[64ch] text-[15px] leading-relaxed text-ch-ink-2">Popular sites are rebooked within minutes of a cancellation. Alerts tell you the moment one opens; Auto-Cart has it in your cart before you&apos;ve unlocked your phone.</p>
      <p className="mt-2 text-[14px] text-ch-ink-2">{foot}</p>
    </section>
  );
}

/** A subscriber: what they can do, never a pitch. */
function AllSet({ visitor, plan, phone }: { visitor: Visitor; plan: Plan; phone: boolean }) {
  const autocart = plan === "autocart";
  const items = [
    `Watch up to ${WATCH_LIMIT} campgrounds at once. We check each one every 15 seconds, around the clock.`,
    phone ? "Alerts reach you by text as well as email. Change the number any time in Settings." : "Add your number in Settings so alerts reach you by text as well as email — a text is what actually wakes you at 6 AM.",
    autocart ? "Auto-cart is connected, so an opening on a Recreation.gov watch goes straight into your cart while you get to your phone." : "With the Auto-Cart plan, an opening goes straight into your Recreation.gov cart while you get to your phone — add it in Settings.",
    "Any alert lets you pause the watch, reopen it, or mute a site you don't want.",
  ];
  return (
    <section aria-labelledby="allset" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-9">
      <h2 id="allset" className="font-ch-display text-[clamp(26px,3.2vw,38px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ch-forest">You&apos;re all set — here&apos;s what you can do</h2>
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
    { id: "base-m", title: "Alerts · Monthly", tier: "base" as const, i: "month" },
    { id: "base-y", title: "Alerts · Yearly", tier: "base" as const, i: "year" },
    { id: "ac-m", title: "Auto-Cart · Monthly", tier: "autocart" as const, i: "month" },
    { id: "ac-y", title: "Auto-Cart · Yearly", tier: "autocart" as const, i: "year" },
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
                <p className="mt-1 text-[14px] leading-relaxed text-ch-ink-2">{t.tier === "base" ? `Up to ${WATCH_LIMIT} campgrounds watched around the clock, with an alert the moment a site opens.` : "Everything in Alerts, plus Auto-Cart: on Recreation.gov an opening goes straight into your cart."}</p>
                <p className="mt-1 flex-1 text-[13px] text-ch-ink-2">{TRIAL_DAYS} days free, then {t.i === "month" ? priceShort(t.tier, "monthly").replace("/mo", "") : priceShort(t.tier, "yearly").replace("/yr", "")} per {t.i}. Renews automatically.</p>
                <button type="button" disabled={buying !== null} onClick={() => { setBuying(t.id); window.setTimeout(() => setBuying(null), 1200); }} className={buttonClasses({ variant: t.tier === "autocart" ? "ink" : "quiet", fullWidth: true, className: "mt-4 min-h-12 disabled:cursor-wait" })}>
                  {buying === t.id ? "Opening…" : `Start free trial — ${t.i === "month" ? priceShort(t.tier, "monthly").replace("/mo", "/month") : priceShort(t.tier, "yearly").replace("/yr", "/year")}`}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" disabled={restore === "busy"} onClick={() => { setRestore("busy"); window.setTimeout(() => setRestore("none"), 900); }} className={buttonClasses({ variant: "quiet", fullWidth: true, className: "mt-4 min-h-12" })}>{restore === "busy" ? "Restoring…" : "Restore purchases"}</button>
          <p role="status" className="mt-2 text-[14px] text-ch-ink-2">{restore === "none" ? "We didn't find an active subscription for this Apple ID." : ""}</p>
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
      ["The night before", "You get an alert naming the site, the nights and the exact release time — with a “hold it for me” button."],
      ["You tap it, or you don’t.", "Nothing happens unless you do. There is no standing setting for this, on purpose — holding a site takes it off the market for everyone else, and that is not a decision to make weeks in advance."],
      ["At 8 AM we put it in a cart", "In seconds, before most people have found the page."],
      ["We text you and let go", `Then your own account can take it. We hold it for up to ${HOLD_MINUTES} minutes, so it is worth answering promptly. You do the booking and the paying — we never do either.`],
    ]} />
  );
  return (
    <section aria-labelledby="rc-hold" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-8">
      <div className="max-w-[70ch]">
        <h2 id="rc-hold" className="font-ch-display text-[22px] font-extrabold leading-tight text-ch-ink">California 8 AM releases — we can hold the site while you wake up</h2>
        {!RC_HOLD_OPEN && (
          <Callout className="mt-4" title={<span className="flex items-center gap-2"><Info aria-hidden="true" className="size-5 shrink-0" />Invite-only for now</span>}>
            Since {RC_HOLD_CLOSED_ON}, 8 AM holds go to a small group of beta accounts while we make them more reliable. Everyone&apos;s ReserveCalifornia watches still alert as usual.
          </Callout>
        )}
        <div className="mt-4 text-[16px] leading-relaxed text-ch-ink-2">
          <p>When somebody cancels a ReserveCalifornia booking, the site usually does not go back on sale straight away — it is released at 8 AM the next morning, and it can be gone in seconds. Because we can see the release time the night before, we can tell you what is coming and offer to be there when it opens.</p>
          <p className="mt-4 flex items-start gap-2 text-[15px]"><span className="mt-0.5 shrink-0 rounded-full bg-ch-shell px-2 py-0.5 text-[12px] font-extrabold text-ch-ink-2">Beta</span><span>8 AM holds are in beta. They have worked on real releases and can still miss — set an alarm for the release time and be ready to book it yourself.</span></p>
          {RC_HOLD_OPEN ? steps : <Collapsible label="How a hold works" className="mt-5">{steps}</Collapsible>}
          <p className="mt-5 text-[14px]">ReserveCalifornia parks only. Recreation.gov has its own auto-cart, which is not in testing and works differently — you connect it once and openings go straight into your cart.</p>
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
      title="Plans & pricing"
      sub="Live search is free and needs no account. A subscription is what keeps a watch running around the clock — and Auto-Cart is what wins the sites that vanish in minutes."
      photo={{ art: ART.p1, pos: "78% 60%", posLg: "50% 62%" }}
      showPlan
      controls={({ visitor }) => (
        <>
          {(visitor === "member" || visitor === "lapsed") && <LabSelect label="Plan lookup" short="Lookup" value={lookup} onChange={setLookup} options={[["ok", "Answered"], ["failed", "Failed"]]} />}
          {(visitor === "member" || visitor === "lapsed") && <LabSelect label="Checkout" short="Checkout" value={checkout} onChange={setCheckout} options={[["works", "Opens"], ["fails", "Fails"]]} />}
          {visitor === "app" && <LabSelect label="App store" short="Store" value={store} onChange={setStore} options={[["sells", "Can sell"], ["cant", "Can't sell"]]} />}
          {visitor === "subscriber" && <LabSelect label="Text alerts" short="Texts" value={phone} onChange={setPhone} options={[["none", "No number"], ["saved", "Number saved"]]} />}
        </>
      )}
    >
      {({ visitor, plan }) => (
        <div className="grid gap-6">
          {visitor === "subscriber" ? <AllSet visitor={visitor} plan={plan} phone={phone === "saved"} />
            : visitor === "app" ? <><AppPaywall store={store} />{store === "sells" && <LabNote>The store tiles show CampHawk&apos;s prices as stand-ins; the real tiles show the App Store&apos;s own price strings.</LabNote>}</>
            : <WebPlans key={`${visitor}-${checkout}`} visitor={visitor} lookup={lookup} checkout={checkout} />}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <HoldExplainer />
          <section aria-labelledby="dont" className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-8">
            <h2 id="dont" className="font-ch-display text-[22px] font-extrabold text-ch-ink">What we don&apos;t do</h2>
            <ul className="mt-3 border-t border-ch-line">
              {LIMITS.map((l) => <li key={l} className="flex gap-3 border-b border-ch-line py-3.5 text-[16px] leading-relaxed text-ch-ink-2"><span aria-hidden="true" className="text-ch-muted">—</span>{l}</li>)}
            </ul>
          </section>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ size: "lg", className: "px-6" })}>Search campgrounds free</Link>
            <A href={ROUTES.home} visitor={visitor}>Back to the home page</A>
          </div>
        </div>
      )}
    </LabPage>
  );
}
