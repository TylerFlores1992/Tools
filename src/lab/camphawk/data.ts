// Fixed copy and figures from campsite-finder (src/components/v2/prices.ts, src/lib/limits.ts,
// src/lib/coverage.ts), copied 2026-10-02. The lab never reads CampHawk's live data or APIs.

export type PlanTier = "base" | "autocart";
export type BillingInterval = "monthly" | "yearly";

export const PLAN_PRICE: Record<PlanTier, Record<BillingInterval, number>> = {
  base: { monthly: 2.5, yearly: 20 },
  autocart: { monthly: 10, yearly: 50 },
};

export const WATCH_LIMIT = 6;

export function dollars(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}
export function priceShort(tier: PlanTier, interval: BillingInterval): string {
  return `${dollars(PLAN_PRICE[tier][interval])}/${interval === "monthly" ? "mo" : "yr"}`;
}
export function pricePhrase(tier: PlanTier, interval: BillingInterval): string {
  return `${dollars(PLAN_PRICE[tier][interval])} a ${interval === "monthly" ? "month" : "year"}`;
}
/** Rounded down, so the claim is never larger than the arithmetic (33, 58). */
export function yearlySavingPercent(tier: PlanTier): number {
  const { monthly, yearly } = PLAN_PRICE[tier];
  return Math.floor((1 - yearly / (monthly * 12)) * 100);
}

export const CAMPGROUNDS_ROUNDED = "8,000+";
/** Canada's provinces and territories with at least one campground we read (of 13). */
export const CANADA_REGIONS = 12;
export const COVERAGE_SENTENCE =
  `Every Recreation.gov campground in all 50 states, plus state parks in 34 — and national, provincial and territorial parks in ${CANADA_REGIONS} of Canada's 13 provinces and territories.`;

/** Who the lab is pretending to be. CampHawk's pricing block has a branch for each; "member"
    (signed in, never subscribed) sees the same pitch as signed out but a different watch button
    (WatchCta's "Start free trial to watch"), and "lapsed" (signed in, subscribed before) gets
    "Resubscribe" wherever CampHawk branches on `everSubscribed`. */
export type Visitor = "signed-out" | "member" | "lapsed" | "subscriber" | "app";
export const VISITORS: readonly { value: Visitor; label: string }[] = [
  { value: "signed-out", label: "Signed out" },
  { value: "member", label: "Signed in" },
  { value: "lapsed", label: "Lapsed" },
  { value: "subscriber", label: "Subscriber" },
  { value: "app", label: "In the app" },
];

/** Signed in on the website (has an account and an avatar), whatever the plan. */
export const hasAccount = (v: Visitor) => v === "member" || v === "lapsed" || v === "subscriber";
