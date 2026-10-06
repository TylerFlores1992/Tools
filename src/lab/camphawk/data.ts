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
export const COVERAGE_SENTENCE =
  "Every Recreation.gov campground in all 50 states, plus state parks in 34 — and national, provincial and territorial parks in 12 of Canada's 13 provinces and territories.";

/** Who the lab is pretending to be. CampHawk's pricing block has a branch for each; "member"
    (signed in, no plan) sees the same pitch as signed out but a different watch button
    (WatchCta's "Start free trial to watch"). */
export type Visitor = "signed-out" | "member" | "subscriber" | "app";
export const VISITORS: readonly { value: Visitor; label: string }[] = [
  { value: "signed-out", label: "Signed out" },
  { value: "member", label: "Signed in" },
  { value: "subscriber", label: "Subscriber" },
  { value: "app", label: "In the app" },
];
