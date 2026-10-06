import { Check } from "lucide-react";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import { AUTOCART_FEATURES, BASE_FEATURES } from "../Pricing";
import { WATCH_LIMIT, pricePhrase, priceShort, yearlySavingPercent, type Visitor } from "../data";

// Round-2 pricing: the same three branches, prices and words as Pricing.tsx, set as a section of
// its own. One elevation system (borders), no caps chips, reading sizes for the fine print.
// `tone` follows the section ground: ink on paper, paper on forest.

// Round-2 copy edit, as in GoldenHour's steps: no "any N nights". Pricing.tsx keeps CampHawk's words.
const plainNights = (f: string) => f.replace("any N nights in a window", "how many nights you need, anywhere in a window");

function Plan({ name, tier, features, recommended }: { name: string; tier: "base" | "autocart"; features: string[]; recommended?: boolean }) {
  return (
    <div className={cx("flex flex-col rounded-[18px] bg-ch-card p-6 sm:p-7", recommended ? "border-2 border-ch-forest" : "border border-ch-line")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-ch-display text-[24px] font-extrabold tracking-[-.02em] text-ch-forest">{name}</h3>
        {recommended && <p className="text-[14px] font-bold text-ch-ink-2">Best chance to book</p>}
      </div>
      <p className="mt-3 font-ch-display text-[40px] font-extrabold leading-none tracking-[-.03em] text-ch-ink tabular-nums">{priceShort(tier, "monthly")}</p>
      <p className="mt-2 text-[15px] text-ch-ink-2">or {priceShort(tier, "yearly")}, save {yearlySavingPercent(tier)}%</p>
      <ul className="mt-5 grid gap-2.5 border-t border-ch-line pt-5">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 text-[16px] leading-snug text-ch-ink-2">
            <Check aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-ch-green" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a href="#" className={buttonClasses({ variant: recommended ? "primary" : "quiet", className: "mt-6 self-start px-5" })}>Start 7-day free trial</a>
    </div>
  );
}

export function Pricing2({ visitor }: { visitor: Visitor }) {
  const head = "max-w-[22ch] font-ch-display text-[clamp(30px,3.6vw,48px)] font-extrabold leading-[1.04] tracking-[-.03em] text-ch-forest";
  const body = "mt-4 max-w-[60ch] text-[17px] leading-relaxed text-ch-ink-2";
  if (visitor === "subscriber") {
    return (
      <div>
        <h2 className={head}>You&apos;re all set. Here&apos;s what you can do.</h2>
        <ul className="mt-6 grid max-w-[64ch] gap-3 text-[16px] leading-relaxed text-ch-ink-2">
          <li>Watch up to {WATCH_LIMIT} campgrounds at once. We check each one every 15 seconds, around the clock.</li>
          <li>Add your number in Settings so alerts reach you by text as well as email — a text is what actually wakes you at 6am.</li>
          <li>With the Auto-Cart plan, an opening goes straight into your Recreation.gov cart while you get to your phone — add it in Settings.</li>
          <li>Any alert lets you pause the watch, reopen it, or mute a site you don&apos;t want.</li>
        </ul>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <a href="#" className={buttonClasses({ className: "px-5" })}>Upgrade to Auto-Cart — {priceShort("autocart", "monthly")}</a>
          <a href="#" className={buttonClasses({ variant: "quiet", className: "px-5" })}>New watch</a>
          <a href="#" className={buttonClasses({ variant: "quiet", className: "px-5" })}>Alert settings</a>
        </div>
      </div>
    );
  }
  if (visitor === "app") {
    return (
      <div>
        <h2 className={head}>Searching is free. Watching needs a subscription.</h2>
        <p className={body}>
          A subscription covers up to {WATCH_LIMIT} watches at once with push, text and email alerts; the Auto-Cart plan adds automatic carting on Recreation.gov. Live search keeps working either way.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="grid gap-x-14 gap-y-4 lg:grid-cols-2 lg:items-end">
        <h2 className={head}>Searching is free. Watching starts at {pricePhrase("base", "monthly")}.</h2>
        <p className="max-w-[60ch] text-[17px] leading-relaxed text-ch-ink-2">
          This is introductory pricing while we&apos;re new, and it will go up as we add campgrounds and states. Subscribe now and you keep the rate you signed up at for as long as your subscription runs.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Plan name="Alerts" tier="base" features={BASE_FEATURES.map(plainNights)} />
        <Plan name="Auto-Cart" tier="autocart" features={AUTOCART_FEATURES} recommended />
      </div>
      <p className="mt-5 text-[15px] text-ch-ink-2">Prices in US dollars.</p>
    </div>
  );
}
