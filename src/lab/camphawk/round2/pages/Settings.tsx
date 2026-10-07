"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CreditCard, Loader2, Mail, ShoppingCart, Trash2, UserRound } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../../ui";
import { Tag } from "../../ui/Tag";
import { pricePhrase, priceShort, type Visitor } from "../../data";
import { LabSelect, type Plan } from "../AppParts";
import { ROUTES } from "../gates";
import { A, LabNote, LabPage, WithRail } from "../LabPage";
import { withVisitor } from "../labState";
import { useUrlState } from "../labState";
import { SmsAlerts } from "../SmsAlerts";
import { useSwapFocus } from "../useSwapFocus";
import { EMAIL } from "./alert-data";

// Tier 1: Settings (campsite-finder src/app/(app)/settings, AutoCartSettings.tsx,
// SignOutConfirm.tsx, DeleteAccount.tsx, RestorePurchases.tsx, lib/manage-destination). Reached
// from the account menu, not a tab. Sections run in the order a new subscriber needs them:
// reach, auto-cart, billing, account. What it keeps on purpose:
// - Email is always on; text is optional and carrier-worded (SmsAlerts, never reworded).
// - The manage button follows who bills you (Stripe, Apple, Google), not the device you're on.
// - A lookup that failed says so ("Your subscription"), never "No subscription yet".
// - No prices in the app; on the web the Auto-Cart upgrade names its price and the proration.
// - Sign out and delete each confirm in place; delete says what happens to billing first.
// Lab changes, from CampHawk's own rules and copy:
// - "all switched on" told Alerts-plan subscribers they had auto-cart; it now names the plan.
// - "Signed out, alerts still reach you by email and text" only says text if a number is saved.
// - "cancelled" is "canceled" (US spelling).
// - The plan label is a plain tag (CampHawk tags it "paused").
// - Auto-cart on is the blue provider tag; set-up and reconnect are blue hand-offs to Recreation.gov.
// - A disconnected session always offers "Reconnect" (CampHawk could show the box with no button).
// - "Start free trial" goes to Pricing, not the marketing home.
// - "Delete account" is a quiet button (red words and a bin icon, so it never looks like Sign
//   out) until you confirm; the red fill is for the step that does it.
// - The ReserveCalifornia hold beta box is gone: the beta closed on Sep 22, 2026.

type AutoCart = "on" | "off" | "not-set-up" | "reconnecting" | "disconnected";
type Billing = "stripe" | "app-store" | "play" | "not-billed" | "unknown";
type Sms = "new" | "saved";
type Page = "ready" | "loading";

const MANAGE: Record<Billing, { label: string; detail: string }> = {
  play: { label: "Manage on Google Play", detail: "Google Play bills this subscription. Change your plan or cancel it there — anything you change applies to CampHawk right away." },
  "app-store": { label: "Manage in the App Store", detail: "Apple bills this subscription. Change your plan or cancel it from your App Store account — anything you change applies to CampHawk right away." },
  stripe: { label: "Manage billing", detail: "CampHawk bills this subscription directly. Update your payment method or cancel in the billing portal." },
  "not-billed": { label: "Contact support", detail: "Your CampHawk access isn't billed through a card or an app store, so there's nothing to manage here. If you expected to be paying for this, get in touch and we'll sort it out." },
  unknown: { label: "Get help with your subscription", detail: "We couldn't check your subscription just now, so we can't say where it's billed. If you subscribed inside the app, manage it from your Google Play or App Store account; if you subscribed on camphawk.app, manage it in the billing portal." },
};

const sm = (variant: "ink" | "quiet" | "cart" | "warn" = "quiet", className?: string) => buttonClasses({ variant, size: "sm", className: cx("min-h-11 px-4", className) });
const off = "disabled:cursor-not-allowed disabled:bg-ch-shell disabled:text-ch-ink-2 disabled:shadow-none";

function Section({ title, blurb, children, id }: { title: string; blurb?: ReactNode; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card sm:p-7">
      <h2 id={id} className="scroll-mt-6 font-ch-display text-[22px] font-extrabold leading-tight text-ch-ink">{title}</h2>
      {blurb && <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-ch-ink-2">{blurb}</p>}
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

// `status`: every channel says its state the same way, a word and a mark on the right (round 7:
// email said it in its title, push said nothing, auto-cart had a pill).
function Box({ icon, title, children, tone = "plain", status }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; tone?: "plain" | "yours"; status?: ReactNode }) {
  return (
    <div className={cx("flex gap-3 rounded-ch-input border px-4 py-3.5", tone === "yours" ? "border-ch-ochre-line bg-ch-ochre-soft" : "border-ch-line bg-ch-paper")}>
      {icon && <span aria-hidden="true" className="mt-0.5 shrink-0 text-ch-ink-2">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[15px] font-bold text-ch-ink"><span>{title}</span>{status}</p>
        {children && <div className="mt-1 text-[14px] leading-relaxed text-ch-ink-2">{children}</div>}
      </div>
    </div>
  );
}

/* ---------- Auto-cart ---------- */

const AUTOCART_BODY = "When a site opens up on Recreation.gov we can put it in your cart automatically, so it's held while you get to your phone.";

function AutoCartSettings({ visitor, plan, state, setState }: { visitor: Visitor; plan: Plan; state: AutoCart; setState: (s: AutoCart) => void }) {
  const entitled = visitor === "subscriber" && plan === "autocart";
  const connect = withVisitor(ROUTES.connect, visitor);
  const [step, setStep] = useState<"idle" | "confirm" | "busy">("idle");
  const { confirmRef: upgradeConfirmRef, triggerRef: upgradeTriggerRef } = useSwapFocus(step !== "idle");
  const [saving, setSaving] = useState(false);

  if (!entitled) {
    return (
      <>
        <div className="flex flex-wrap gap-1.5">
          <Tag kind="src" srPrefix="Plan:">Auto-Cart plan</Tag>
          <Tag kind="src">Recreation.gov only</Tag>
        </div>
        <p className="text-[15px] leading-relaxed text-ch-ink-2">{AUTOCART_BODY} Auto-cart comes with the Auto-Cart plan.</p>
        {visitor === "app" ? (
          // The app sells through the store's own paywall: no price here, ever.
          <a href="#" className={sm("quiet", "justify-self-start")}>See the Auto-Cart plan</a>
        ) : visitor === "subscriber" ? (
          <div className="rounded-ch-input border border-ch-line bg-ch-paper p-4">
            <p className="text-[15px] font-bold text-ch-ink">Add Auto-Cart to your subscription</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ch-ink-2">{pricePhrase("autocart", "monthly")}, or {pricePhrase("autocart", "yearly")} — you keep your current billing cycle and Stripe prorates the difference from today.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {step === "idle" ? (
                <button ref={upgradeTriggerRef} type="button" onClick={() => setStep("confirm")} className={sm("ink")}>Upgrade to Auto-Cart</button>
              ) : (
                <>
                  <button type="button" disabled={step === "busy"} onClick={() => setStep("busy")} className={sm("ink", off)}>
                    {step === "busy" ? <><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />Upgrading…</> : "Confirm upgrade"}
                  </button>
                  <button ref={upgradeConfirmRef} type="button" aria-disabled={step === "busy" || undefined} onClick={() => { if (step !== "busy") setStep("idle"); }} className={sm()}>Cancel</button>
                </>
              )}
            </div>
            {step === "busy" && <LabNote className="mt-3">Nothing is charged here. Switch Plan to Auto-Cart to see what comes next.</LabNote>}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <a href="#" className={sm()}>Auto-Cart — {priceShort("autocart", "monthly").replace("/mo", " / month")}</a>
            <a href="#" className={sm("ink")}>Auto-Cart — {priceShort("autocart", "yearly").replace("/yr", " / year")}</a>
          </div>
        )}
      </>
    );
  }

  // Neutral like every other state in Settings: a state is not a hand-off, so it isn't blue.
  const tag = state === "on" ? <Tag kind="paused" mark="on">On</Tag> : <Tag kind="paused" mark={({ off: "off", "not-set-up": "not-set-up", reconnecting: "reconnecting", disconnected: "needs-you" } as const)[state]}>{{ off: "Off", "not-set-up": "Not set up", reconnecting: "Reconnecting", disconnected: "Disconnected" }[state]}</Tag>;
  const connected = state === "on" || state === "off";
  return (
    <>
      <div className="flex flex-wrap gap-1.5">{tag}<Tag kind="src">Recreation.gov only</Tag></div>
      <p className="text-[15px] leading-relaxed text-ch-ink-2">{AUTOCART_BODY} It signs in to your Recreation.gov account on a private machine we run, and saves that login there — encrypted, never on our web servers — so it can sign back in on its own whenever the session drops.</p>
      {state === "reconnecting" && (
        <Box tone="yours" icon={<AlertTriangle className="size-5" />} title="Auto-cart is reconnecting">
          <p>The machine holding your Recreation.gov session hasn&apos;t checked in for a few minutes, so we can&apos;t hold a site for you right now. Your login is saved, so it signs back in on its own — and your watches keep alerting you the whole time. If this is still here in an hour, signing in again will fix it.</p>
          <Link href={connect} className={sm("quiet", "mt-3")}>Sign in to Recreation.gov again</Link>
        </Box>
      )}
      {state === "disconnected" && (
        <Box tone="yours" icon={<AlertTriangle className="size-5" />} title="Auto-cart is disconnected">
          Recreation.gov signed CampHawk out of your account, so we can&apos;t put an opening in your cart right now. Your watches keep alerting you. Sign in again and auto-cart picks back up.
        </Box>
      )}
      {(state === "disconnected" || state === "not-set-up") && (
        <Link href={connect} className={sm("cart", "justify-self-start")}>{state === "disconnected" ? "Reconnect Recreation.gov" : "Set up auto-cart"}</Link>
      )}
      {connected && (
        <div className="flex flex-wrap items-center gap-3 rounded-ch-input border border-ch-line bg-ch-paper px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-ch-ink">{state === "on" ? "Auto-cart is on" : "Auto-cart is off"}</p>
            <p className="text-[13px] text-ch-ink-2">Session confirmed 12 minutes ago.</p>
          </div>
          <button type="button" disabled={saving} onClick={() => { setSaving(true); window.setTimeout(() => { setSaving(false); setState(state === "on" ? "off" : "on"); }, 500); }} className={sm(state === "on" ? "quiet" : "cart", off)}>
            {saving ? "Saving…" : state === "on" ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}
      {state !== "not-set-up" && <p className="text-[13px] text-ch-ink-2">Signed in on the wrong Recreation.gov account? <A href={ROUTES.connect} visitor={visitor}>Sign in again</A>.</p>}
    </>
  );
}

/* ---------- Subscription ---------- */

function RestorePurchases() {
  const [s, setS] = useState<"idle" | "busy" | "none">("idle");
  return (
    <div className="border-t border-ch-line pt-4">
      <button type="button" disabled={s === "busy"} onClick={() => { setS("busy"); window.setTimeout(() => setS("none"), 900); }} className={sm("quiet", off)}>
        {s === "busy" ? "Restoring…" : "Restore purchases"}
      </button>
      <p role="status" className="mt-2 text-[14px] text-ch-ink-2">{s === "none" ? "We didn't find an active subscription for this Apple ID." : ""}</p>
    </div>
  );
}

function Subscription({ visitor, plan, billing }: { visitor: Visitor; plan: Plan; billing: Billing }) {
  if (visitor === "subscriber") {
    const m = MANAGE[billing];
    const known = billing !== "unknown";
    const on = plan === "autocart" ? "Watching, alerts and auto-cart are all switched on." : "Watching and alerts are switched on, on the Alerts plan.";
    return (
      <div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px] font-bold text-ch-ink">{known ? <>Your subscription<Tag kind="paused" mark="active" srPrefix="Status:">Active</Tag></> : "Your subscription"}</p>
        {known && billing !== "not-billed" && (
          <p className="mt-1 text-[15px] text-ch-ink tabular-nums">
            {plan === "autocart" ? "Auto-Cart plan" : "Alerts plan"}
            {billing === "stripe" ? `, ${priceShort(plan === "autocart" ? "autocart" : "base", "monthly")}, renews Aug 6, 2026` : `, billed by ${billing === "app-store" ? "the App Store" : "Google Play"}`}
          </p>
        )}
        <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-ch-ink-2">{known && `${on} `}{m.detail}</p>
        <a href={billing === "not-billed" ? "mailto:alerts@camphawk.app" : "#"} className={sm("quiet", "mt-3")}>{m.label}</a>
      </div>
    );
  }
  if (visitor === "app") {
    return (
      <>
        <p className="text-[15px] leading-relaxed text-ch-ink-2">Watching needs a subscription.</p>
        <a href="#" className={sm("ink", "justify-self-start")}>See plans</a>
        <RestorePurchases />
      </>
    );
  }
  const ended = visitor === "lapsed";
  return (
    <div>
      <p className="text-[16px] font-bold text-ch-ink">{ended ? "Your subscription has ended" : "No subscription yet"}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-ch-ink-2">Searching stays free. Watching a booked campground, text alerts and auto-cart need a subscription.</p>
      <Link href={withVisitor(ROUTES.pricing, visitor)} className={sm("ink", "mt-3")}>{ended ? "Resubscribe" : "Start free trial"}</Link>
    </div>
  );
}

/* ---------- Account ---------- */

function SignOutConfirm({ textOn }: { textOn: boolean }) {
  const [s, setS] = useState<"idle" | "confirm" | "busy">("idle");
  const { confirmRef, triggerRef } = useSwapFocus(s !== "idle");
  return (
    <div className="border-t border-ch-line pt-4">
      <p className="text-[14px] leading-relaxed text-ch-ink-2">Your watches keep running while you&apos;re signed out — alerts still reach you by {textOn ? "email and text" : "email"}.</p>
      {s === "idle" ? (
        <button ref={triggerRef} type="button" onClick={() => setS("confirm")} className={sm("quiet", "mt-3")}>Sign out</button>
      ) : (
        <div role="group" aria-labelledby="signout-q" className="mt-3 rounded-ch-input bg-ch-shell p-4">
          <p id="signout-q" className="text-[15px] font-bold text-ch-ink">Sign out of CampHawk?</p>
          <p className="mt-1 text-[14px] text-ch-ink-2">You&apos;ll need your email and password to get back in. Nothing is deleted.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={s === "busy"} onClick={() => setS("busy")} className={sm("ink", off)}>{s === "busy" ? "Signing out…" : "Yes, sign me out"}</button>
            <button ref={confirmRef} type="button" aria-disabled={s === "busy" || undefined} onClick={() => { if (s !== "busy") setS("idle"); }} className={sm()}>Stay signed in</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteAccount({ visitor, billing }: { visitor: Visitor; billing: Billing }) {
  const guest = visitor === "app";
  const noun = guest ? "your data" : "your account";
  const [s, setS] = useState<"idle" | "confirm" | "busy">("idle");
  const { confirmRef, triggerRef } = useSwapFocus(s !== "idle");
  const store = billing === "app-store" ? "App Store" : billing === "play" ? "Google Play" : null;
  let bill: ReactNode;
  if (guest) bill = <>If you bought a subscription in the app, it is billed by the App Store, and deleting your data <strong className="font-bold text-ch-ink">does not cancel it</strong> — cancel it in your store subscription settings.</>;
  else if (visitor === "subscriber" && store) bill = <><strong className="font-bold text-ch-ink">Your subscription is billed by the {store}, and deleting {noun} does not cancel it.</strong> Cancel it first in your {store} subscription settings, or the {store} will keep charging you.</>;
  else if (visitor === "subscriber" && billing === "stripe") bill = <><strong className="font-bold text-ch-ink">Your subscription is canceled immediately.</strong> You won&apos;t be charged again, and the remainder of the period you&apos;ve already paid for is not refunded.</>;
  else bill = <>If you have a subscription on camphawk.app, it is <strong className="font-bold text-ch-ink">canceled immediately</strong> — you won&apos;t be charged again, and the remainder of the period you&apos;ve already paid for is not refunded. A subscription bought in the App Store or Google Play is canceled in your store settings.</>;
  return (
    <>
      <p className="text-[15px] leading-relaxed text-ch-ink-2">Deleting {noun} removes your watches, alert history and saved campgrounds permanently. This can&apos;t be undone.</p>
      <p className="text-[15px] leading-relaxed text-ch-ink-2">{bill}</p>
      {s === "idle" ? (
        <button ref={triggerRef} type="button" onClick={() => setS("confirm")} className={sm("quiet", "justify-self-start text-ch-alert-deep!")}><Trash2 aria-hidden="true" className="size-4" />{guest ? "Delete my data" : "Delete account"}</button>
      ) : (
        <div role="group" aria-labelledby="delete-q" className="rounded-ch-input border-2 border-ch-alert bg-ch-card p-4">
          <p id="delete-q" className="flex items-center gap-2 text-[15px] font-bold text-ch-ink"><AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-ch-alert" />{guest ? "Delete your data?" : "Delete your account?"}</p>
          <p className="mt-1 text-[14px] text-ch-ink-2">Everything above happens as soon as you press the button, and we can&apos;t bring any of it back.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={s === "busy"} onClick={() => setS("busy")} className={sm("warn", off)}>{s === "busy" ? "Deleting…" : guest ? "Yes, delete my data" : "Yes, delete my account"}</button>
            <button ref={confirmRef} type="button" aria-disabled={s === "busy" || undefined} onClick={() => { if (s !== "busy") setS("idle"); }} className={sm()}>{guest ? "Keep my data" : "Keep my account"}</button>
          </div>
          {s === "busy" && <LabNote className="mt-3">Nothing is deleted here.</LabNote>}
        </div>
      )}
    </>
  );
}

/* ---------- page ---------- */

export function Settings() {
  const [autoCart, setAutoCart] = useUrlState<AutoCart>("autocart", "on", ["on", "off", "not-set-up", "reconnecting", "disconnected"]);
  const [billing, setBilling] = useUrlState<Billing>("billing", "stripe", ["stripe", "app-store", "play", "not-billed", "unknown"]);
  const [sms, setSms] = useUrlState<Sms>("sms", "saved", ["new", "saved"]);
  const [page, setPage] = useUrlState<Page>("state", "ready", ["ready", "loading"]);
  return (
    <LabPage
      page="Settings"
      title="Settings"
      showPlan
      controls={({ visitor, plan }) => (
        <>
          {visitor !== "signed-out" && <LabSelect label="Page" short="Page" value={page} onChange={setPage} options={[["ready", "Loaded"], ["loading", "Loading"]]} />}
          {visitor === "subscriber" && <LabSelect label="Billed by" short="Billed by" value={billing} onChange={setBilling} options={[["stripe", "CampHawk (Stripe)"], ["app-store", "App Store"], ["play", "Google Play"], ["not-billed", "Not billed"], ["unknown", "Couldn't check"]]} />}
          {visitor === "subscriber" && plan === "autocart" && <LabSelect label="Auto-cart" short="Auto-cart" value={autoCart} onChange={setAutoCart} options={[["on", "On"], ["off", "Off"], ["not-set-up", "Not set up"], ["reconnecting", "Reconnecting"], ["disconnected", "Disconnected"]]} />}
          {visitor !== "signed-out" && visitor !== "app" && <LabSelect label="Text alerts" short="Texts" value={sms} onChange={setSms} options={[["saved", "Number saved"], ["new", "No number"]]} />}
        </>
      )}
    >
      {({ visitor, plan }) => {
        if (visitor === "signed-out") {
          return (
            <div className="grid overflow-hidden rounded-ch-card border border-ch-line bg-ch-card shadow-ch-pop lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="p-6 sm:p-10">
                <h2 className="font-ch-display text-[clamp(24px,2.6vw,32px)] font-extrabold leading-[1.15] tracking-[-.02em] text-ch-ink">Settings need an account</h2>
                <p className="mt-2 max-w-[48ch] text-[16px] leading-relaxed text-ch-ink-2">Alerts go to your email, your phone and your devices, so they&apos;re tied to your account. Searching stays free either way.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href={withVisitor(ROUTES.signIn, visitor)} className={buttonClasses({ variant: "ink", className: "min-h-12 px-6" })}>Sign in</Link>
                  <Link href={withVisitor(ROUTES.explore, visitor)} className={buttonClasses({ variant: "quiet", className: "min-h-12 px-6" })}>Back to Explore</Link>
                </div>
              </div>
              <div className="border-t border-ch-line bg-ch-paper p-6 sm:p-10 lg:border-l lg:border-t-0">
                <h3 className="text-[15px] font-bold text-ch-ink">What you set here</h3>
                <ul className="mt-3 grid gap-3 text-[15px] leading-snug text-ch-ink-2">
                  {([[Bell, "How we reach you", "Email, text messages and push."], [ShoppingCart, "Auto-cart", "Connect Recreation.gov so an opening can land in your cart."], [CreditCard, "Subscription", "Your plan, and how to change or cancel it."], [UserRound, "Account", "Signing out, and deleting your account and its data."]] as const).map(([Icon, t, d]) => (
                    <li key={t} className="flex gap-3"><Icon aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-ch-ink-2" /><span><strong className="block text-ch-ink">{t}</strong>{d}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          );
        }
        if (page === "loading") {
          return (
            <div role="status" className="grid max-w-[760px] gap-5">
              <span className="sr-only">Loading your settings…</span>
              {[0, 1, 2].map((i) => <div key={i} aria-hidden="true" className="h-40 animate-pulse rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card motion-reduce:animate-none" />)}
            </div>
          );
        }
        const guest = visitor === "app";
        const textOn = sms === "saved";
        return (
          <WithRail toc={[["s-reach", "How we reach you"], ["s-cart", "Auto-cart"], ["s-sub", "Subscription"], ["s-account", "Account"], ["s-delete", guest ? "Delete your data" : "Delete account"]]}>
          <div className="grid max-w-[760px] gap-5">
            {guest ? (
              <Section id="s-reach" title="How we reach you" blurb="You're using CampHawk without an account. When a site opens up, the alert comes to this device as a notification.">
                <Box icon={<Bell className="size-5" />} title="Push notifications">Controlled by your phone&apos;s notification settings for CampHawk. Keep them on — they are how your alerts reach you.</Box>
                <Box icon={<Mail className="size-5" />} title="Email and text alerts">Optional, with a free account — they go to an address and a number, so they need one.</Box>
              </Section>
            ) : (
              <Section id="s-reach" title="How we reach you" blurb="When a site opens up we send every channel you've turned on, at once. Whichever gets to you first wins.">
                <Box icon={<Mail className="size-5" />} title="Email" status={<Tag kind="paused" mark="on" srPrefix="Status:">Always on</Tag>}>Every opening we find goes to {EMAIL}.</Box>
                <Box icon={<Bell className="size-5" />} title="Push notifications" status={<Tag kind="paused" mark="not-set-up" srPrefix="Status:">App only</Tag>}>Install CampHawk on your phone and sign in, and alerts arrive there as notifications too.</Box>
                <SmsAlerts key={sms} start={sms} visitor={visitor} />
              </Section>
            )}
            <Section id="s-cart" title="Auto-cart">
              <AutoCartSettings key={`${visitor}-${plan}`} visitor={visitor} plan={plan} state={autoCart} setState={setAutoCart} />
            </Section>
            <Section id="s-sub" title="Subscription">
              <Subscription visitor={visitor} plan={plan} billing={billing} />
            </Section>
            <Section id="s-account" title="Account">
              {guest ? (
                <div>
                  <p className="text-[16px] font-bold text-ch-ink">No account — and you don&apos;t need one.</p>
                  <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-ch-ink-2">A free account is optional. It adds email and text alerts, and lets you use your subscription on camphawk.app and your other devices. Your watches and subscription move to it when you sign in.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={withVisitor(ROUTES.signUp, visitor)} className={sm("ink")}>Create a free account</Link>
                    <Link href={withVisitor(ROUTES.signIn, visitor)} className={sm()}>Sign in</Link>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[16px] font-bold text-ch-ink">{EMAIL}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-ch-ink-2">Your email address, password and sign-in methods live in your account menu, in the top right of the page.</p>
                  </div>
                  <SignOutConfirm textOn={textOn} />
                </>
              )}
            </Section>
            <Section id="s-delete" title={guest ? "Delete your data" : "Delete account"}>
              <DeleteAccount visitor={visitor} billing={billing} />
            </Section>
            {guest && <p className="text-center text-[13px] text-ch-ink-2">CampHawk app build 1.4 (22)</p>}
          </div>
          </WithRail>
        );
      }}
    </LabPage>
  );
}
