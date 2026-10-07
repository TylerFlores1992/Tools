"use client";

import Link from "next/link";
import { ROUTES } from "../gates";
import { LabPage } from "../LabPage";
import { withVisitor } from "../labState";

// The map of the lab: every CampHawk screen built in the Golden hour look, grouped the way the
// build was planned (docs/NEXT-SESSION.md), each with the switches that change it. "View as"
// carries across every link.

type Item = { href: string; name: string; what: string; switches?: string };

export const SCREEN_GROUPS: ReadonlyArray<{ title: string; note: string; items: Item[] }> = [
  {
    title: "The core camper flow",
    note: "Search, a campground, and starting and keeping watches.",
    items: [
      { href: ROUTES.home, name: "Home", what: "The marketing home: the promise, search, what a watch does, plans." },
      { href: ROUTES.explore, name: "Explore", what: "Live search with filters, the four result answers and the map.", switches: "Search answers" },
      { href: ROUTES.campground, name: "Campground", what: "One campground's calendar, answer first, and its site map drawn from public data. Any Explore result opens its own.", switches: "Booking, page state, arrived from, map" },
      { href: `${ROUTES.campground}?id=jedediah-smith`, name: "Campground: a ReserveCalifornia map", what: "Jedediah Smith's site map from California State Parks' campsite data. Local run only until State Parks approves; deployed, it shows the not-drawn state." },
      { href: ROUTES.newWatch, name: "New watch", what: "Pick a campground and nights; only a subscriber can start one.", switches: "Plan, on submit" },
      { href: ROUTES.watches, name: "Your watches", what: "Every watch card state, holds, alert history.", switches: "Plan, page state, phone, provider, auto-cart" },
    ],
  },
  {
    title: "After an alert",
    note: "Where a subscriber lands from a text or an email.",
    items: [
      { href: ROUTES.manage, name: "Manage a watch", what: "The watch an alert is about: what's open, dates, muting, pause and remove.", switches: "Watch state" },
      { href: ROUTES.action, name: "One-tap action", what: "What a tapped link in an alert did, and how to undo it; the 8am hold confirm.", switches: "Action" },
      { href: ROUTES.claim, name: "Claim a held site", what: "A ReserveCalifornia site we're holding, and handing it over to you.", switches: "Hold status, device" },
      { href: ROUTES.settings, name: "Settings", what: "How we reach you, auto-cart, subscription, sign out, delete account.", switches: "Plan, auto-cart, billing" },
      { href: ROUTES.connect, name: "Connect Recreation.gov", what: "Linking a Recreation.gov login so auto-cart can work.", switches: "Step" },
      { href: ROUTES.welcome, name: "Welcome", what: "The one-time step after sign-up.", switches: "Step" },
    ],
  },
  {
    title: "Getting and keeping customers",
    note: "Plans, signing in, and the pages that explain the product.",
    items: [
      { href: ROUTES.pricing, name: "Pricing", what: "The two plans, by who's looking; the in-app store paywall.", switches: "Checkout" },
      { href: ROUTES.signIn, name: "Sign in", what: "Clerk's sign-in, in CampHawk's frame." },
      { href: ROUTES.signUp, name: "Sign up", what: "Clerk's sign-up, keeping where you were headed." },
      { href: ROUTES.autoCart, name: "Auto-cart", what: "What auto-cart does and doesn't do." },
      { href: ROUTES.alerts, name: "Cancellation alerts", what: "The landing page for campsite cancellation alerts." },
      { href: ROUTES.soldOut, name: "Sold-out guide", what: "What actually works when a campground is sold out." },
    ],
  },
  {
    title: "Search pages",
    note: "The pages people find from Google.",
    items: [
      { href: ROUTES.camping, name: "Camping by state", what: "Every state and province with a page." },
      { href: `${ROUTES.camping}/california`, name: "A state: California", what: "One state's campgrounds, by provider." },
      { href: `${ROUTES.camping}/cabins`, name: "Cabins", what: "Where to book a cabin, by state; yurts and group camping share the template." },
      { href: `${ROUTES.camping}/cabins/california`, name: "Cabins in California", what: "One state's campgrounds with cabins." },
      { href: ROUTES.hardest, name: "Hardest to book", what: "CampHawk's own pick of the campgrounds that fill fastest." },
      { href: ROUTES.vsCampflare, name: "CampHawk vs Campflare", what: "The comparison page; CampHawk makes no claims about the competitor." },
      { href: ROUTES.vsCampnab, name: "CampHawk vs Campnab", what: "The same template, for Campnab." },
    ],
  },
  {
    title: "Utility and legal",
    note: "Reachable signed out and inside the app.",
    items: [
      { href: ROUTES.support, name: "Support", what: "The questions people actually write in about." },
      { href: ROUTES.sources, name: "Data sources", what: "Every official source, with the not-a-government-app disclaimer first." },
      { href: ROUTES.smsOptIn, name: "Text alert opt-in", what: "The carrier-approved opt-in form, as a preview." },
      { href: ROUTES.privacy, name: "Privacy", what: "CampHawk's privacy policy as published." },
      { href: ROUTES.terms, name: "Terms", what: "CampHawk's terms as published." },
      { href: `${ROUTES.home}/errors`, name: "Not found and errors", what: "The not-found, error and whole-app-failed screens.", switches: "Screen" },
    ],
  },
];

export function Screens() {
  return (
    <LabPage page="All screens" title="Every screen in the lab" dock={false} wide
      sub={`CampHawk in the Golden hour look: ${SCREEN_GROUPS.reduce((n, g) => n + g.items.length, 0)} screens, mockups only. "View as" in the bar above carries across every link.`}>
      {({ visitor }) => (
        <div className="grid gap-12">
          {SCREEN_GROUPS.map((g) => (
            <section key={g.title} aria-labelledby={`g-${g.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              <h2 id={`g-${g.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="font-ch-display text-[clamp(24px,2.6vw,32px)] font-extrabold tracking-[-.02em] text-ch-forest">{g.title}</h2>
              <p className="mt-1 text-[16px] text-ch-ink-2">{g.note}</p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((it) => (
                  <li key={it.href}>
                    <Link href={withVisitor(it.href, visitor)} className="flex h-full flex-col rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-card hover:border-ch-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green">
                      <span className="font-ch-display text-[19px] font-extrabold text-ch-ink">{it.name}</span>
                      <span className="mt-1 flex-1 text-[15px] leading-relaxed text-ch-ink-2">{it.what}</span>
                      {it.switches && <span className="mt-3 text-[13px] text-ch-muted">Lab switches: {it.switches}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </LabPage>
  );
}
