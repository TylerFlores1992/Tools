import { Clock, MapPin, ShoppingCart, Zap } from "lucide-react";
import { CAMPGROUNDS_ROUNDED } from "./data";

// CampHawk's home-page copy (campsite-finder src/app/(app)/page.tsx, 2026-10-02), shared by the
// current home and the round-2 directions so every design says the same thing.

export const HEADLINE = "The campsite you wanted is already booked. We wait for it.";
export const INTRO = `CampHawk watches booked campgrounds around the clock and tells you the second someone cancels — usually within seconds. Live search across ${CAMPGROUNDS_ROUNDED} campgrounds is always free.`;
export const FOOTER_LINKS = ["Pricing", "Support", "Data sources", "Terms", "Privacy"] as const;

export const FEATURES = [
  { icon: Clock, title: "Alerts in seconds", body: "We check watched campgrounds every 15 seconds, around the clock. When someone cancels, you usually hear about it within seconds of the site coming back — not after someone else has booked it." },
  { icon: ShoppingCart, title: "Auto-cart on Recreation.gov", body: "We can put the opening straight into your cart, so it’s held while you get to your phone. You just check out." },
  { icon: MapPin, title: "Live search — free, no account", body: `Real-time availability at ${CAMPGROUNDS_ROUNDED} campgrounds, on a map, with filters for tents, RVs, hookups and pad length. No subscription, no sign-up.` },
  { icon: Zap, title: "Flexible dates find more", body: "Say how many nights you need and a window to look in. Any three nights next month gives us far more chances to catch a cancellation than one fixed weekend." },
];

export const STEPS = [
  ["Find the campground", "Search by place and dates. If sites are open you’ll see them right there — that part’s free."],
  ["Watch it if it’s full", "One tap. Pick exact dates, or any N nights inside a window you’re free."],
  ["Get the site", "Email, push and text the moment it opens — and on Recreation.gov it can already be in your cart."],
] as const;

export const LIMITS = [
  "We never check out or pay for anything. Checkout is always yours, on the provider’s site.",
  "We can’t create availability — if nobody cancels, there’s nothing to find.",
  "We can’t cancel or change a reservation you already have.",
];
