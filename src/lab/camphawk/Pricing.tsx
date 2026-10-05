import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { buttonClasses } from "./ui";
import { WATCH_LIMIT, pricePhrase, priceShort, yearlySavingPercent, type Visitor } from "./data";

// Ported from campsite-finder src/components/v2/PricingSection.tsx + Pricing.tsx (2026-10-02).
// Same three branches, driven by the lab's visitor switch instead of Clerk and the native
// bridge: signed out (the pitch), subscriber (navigation, never prices), app (no prices).

export const BASE_FEATURES = [
  `Watch up to ${WATCH_LIMIT} campgrounds at once`,
  "Checked every 15 seconds, around the clock",
  "Text, push and email the moment a site opens",
  "Flexible dates — any N nights in a window",
];
export const AUTOCART_FEATURES = [
  "Everything in Alerts",
  "An opening goes straight into your Recreation.gov cart",
  "The site is held while you get to your phone",
  "You just sign in and check out",
];

function PlanCard({ name, price, sub, features, highlight, cta }: { name: string; price: string; sub: string; features: string[]; highlight?: boolean; cta: ReactNode }) {
  return (
    <div className={highlight ? "look-card relative rounded-ch-card border-2 border-ch-green bg-ch-card p-4 shadow-ch-card" : "look-card rounded-ch-card border border-ch-line bg-ch-card/70 p-4"}>
      {highlight && (
        <span className="absolute -top-2.5 left-4 rounded-ch-chip bg-ch-green px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-ch-white">Best chance to book</span>
      )}
      <p className="font-ch-display text-ch-h font-extrabold text-ch-green-deep">{name}</p>
      <p className="mt-1 text-[22px] font-extrabold tracking-[-.02em] text-ch-ink">
        {price}
        <span className="ml-1.5 align-middle text-ch-fine font-normal text-ch-muted">{sub}</span>
      </p>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex gap-2 text-ch-fine leading-normal text-ch-ink-2">
            <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-ch-green" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3.5">{cta}</div>
    </div>
  );
}

function Plans() {
  return (
    <div>
      <div className="grid gap-3 pt-2.5 sm:grid-cols-2">
        <PlanCard
          name="Alerts"
          price={priceShort("base", "monthly")}
          sub={`or ${priceShort("base", "yearly")} — save ${yearlySavingPercent("base")}%`}
          features={BASE_FEATURES}
          cta={<a href="#" className={buttonClasses({ variant: "quiet", size: "sm" })}>Start 7-day free trial</a>}
        />
        <PlanCard
          name="Auto-Cart"
          price={priceShort("autocart", "monthly")}
          sub={`or ${priceShort("autocart", "yearly")} — save ${yearlySavingPercent("autocart")}%`}
          features={AUTOCART_FEATURES}
          highlight
          cta={<a href="#" className={buttonClasses({ size: "sm" })}>Start 7-day free trial</a>}
        />
      </div>
      <p className="mt-3 max-w-[58ch] text-ch-fine leading-normal text-ch-muted">
        Popular sites are rebooked within minutes of a cancellation. Alerts tell you the moment one opens; Auto-Cart has it in your cart before you&apos;ve unlocked your phone.
      </p>
      <p className="mt-2 text-ch-fine text-ch-muted">
        Prices in US dollars. Free for 7 days · cancel any time before you&apos;re charged. Launch pricing — your rate is locked in while you stay subscribed.
      </p>
    </div>
  );
}

export function PricingSection({ visitor }: { visitor: Visitor }) {
  if (visitor === "subscriber") {
    return (
      <div className="rounded-ch-card border border-ch-green-line bg-ch-green-soft p-5 sm:p-6">
        <h2 className="font-ch-display text-ch-title font-extrabold tracking-[-.03em] text-ch-green-deep">You&apos;re all set — here&apos;s what you can do</h2>
        <ul className="mt-2.5 max-w-[58ch] space-y-1.5 text-ch-body leading-relaxed text-ch-green-deep">
          <li>Watch up to {WATCH_LIMIT} campgrounds at once. We check each one every 15 seconds, around the clock.</li>
          <li>Add your number in Settings so alerts reach you by text as well as email — a text is what actually wakes you at 6am.</li>
          <li>With the Auto-Cart plan, an opening goes straight into your Recreation.gov cart while you get to your phone — add it in Settings.</li>
          <li>Any alert lets you pause the watch, reopen it, or mute a site you don&apos;t want.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <a href="#" className={buttonClasses({ variant: "primary" })}>Upgrade to Auto-Cart — {priceShort("autocart", "monthly")}</a>
          <a href="#" className={buttonClasses({ variant: "quiet" })}>New watch</a>
          <a href="#" className={buttonClasses({ variant: "quiet" })}>Alert settings</a>
        </div>
      </div>
    );
  }
  if (visitor === "app") {
    return (
      <div className="rounded-ch-card border border-ch-green-line bg-ch-green-soft p-5 sm:p-6">
        <h2 className="font-ch-display text-ch-title font-extrabold tracking-[-.03em] text-ch-green-deep">Searching is free. Watching needs a subscription.</h2>
        <p className="mt-2 max-w-[58ch] text-ch-body leading-relaxed text-ch-green-deep">
          A subscription covers up to {WATCH_LIMIT} watches at once with push, text and email alerts; the Auto-Cart plan adds automatic carting on Recreation.gov. Live search keeps working either way.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-ch-card border border-ch-green-line bg-ch-green-soft p-5 sm:p-6">
      <span className="inline-block rounded-ch-chip bg-ch-card px-3 py-1 text-ch-label font-bold uppercase tracking-[.1em] text-ch-green-deep">Launch pricing</span>
      <h2 className="mt-2.5 font-ch-display text-ch-title font-extrabold tracking-[-.03em] text-ch-green-deep">Searching is free. Watching starts at {pricePhrase("base", "monthly")}.</h2>
      <p className="mt-2 max-w-[58ch] text-ch-body leading-relaxed text-ch-green-deep">Cancel any time — and live search keeps working either way.</p>
      <p className="mt-2 max-w-[58ch] text-ch-meta leading-normal text-ch-green-deep">
        This is introductory pricing while we&apos;re new, and it will go up as we add campgrounds and states. Subscribe now and you keep the rate you signed up at for as long as your subscription runs.
      </p>
      <div className="mt-4">
        <Plans />
      </div>
    </div>
  );
}
