import type { Visitor } from "../data";

// CampHawk's account gates (campsite-finder src/components/v2/WatchCta.tsx, SubscribeCta.tsx),
// driven by the lab's "View as" instead of Clerk, Stripe and the native bridge. One place, so
// every Golden hour screen offers the same control to the same visitor.

export const GH = "/private/camphawk/golden-hour";
export const ROUTES = {
  home: GH,
  explore: `${GH}/explore`,
  newWatch: `${GH}/new`,
  watches: `${GH}/watches`,
  campground: `${GH}/campground`,
} as const;

/** WatchCta: the label a watch button carries for this visitor. `label` is what a subscriber
    (who can create a watch) sees; everyone else gets the step that is actually open to them. */
export function watchCtaLabel(visitor: Visitor, label = "Start a watch"): string {
  if (visitor === "subscriber") return label;
  if (visitor === "app") return "Subscribe to watch";
  if (visitor === "member") return "Start free trial to watch";
  if (visitor === "lapsed") return "Resubscribe to watch";
  return "Sign up to watch";
}

/** Only a subscriber reaches the New watch form; the others go where their next step is. */
export const canWatch = (v: Visitor) => v === "subscriber";

/** SubscribeCta's gate. "app" here is the app's guest (no account), which SubscribeCta sends to
    the in-app paywall. */
export type AccountGate = "ready" | "signedOut" | "needsSub" | "appGuest";
export function accountGate(v: Visitor): AccountGate {
  if (v === "subscriber") return "ready";
  if (v === "signed-out") return "signedOut";
  if (v === "app") return "appGuest";
  return "needsSub";
}
