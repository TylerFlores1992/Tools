import Link from "next/link";
import { cx } from "@/components/cx";
import { buttonClasses } from "../ui";
import { hasAccount, type Visitor } from "../data";
import { FOOTER_LINKS } from "../copy";
import { ROUTES } from "./gates";
import { withVisitor } from "./labState";

// Golden hour's chrome, shared by every screen in that look: the header sits on forest (a photo
// or a plain band) in paper type; the footer closes on forest. The three tabs are CampHawk's
// (V2Nav) and link between the lab's screens, keeping the "View as" choice.

export type Tab = "watches" | "new" | "explore";
const TABS: ReadonlyArray<{ tab: Tab; label: string; href: string }> = [
  { tab: "watches", label: "Watches", href: ROUTES.watches },
  { tab: "new", label: "New watch", href: ROUTES.newWatch },
  { tab: "explore", label: "Explore", href: ROUTES.explore },
];

/** Header over the photo: paper type on the dark scrim. Same links and account states as Nav. */
export function PhotoHeader({ visitor, current }: { visitor: Visitor; current?: Tab }) {
  return (
    <header className="relative z-10">
      <div className="mx-auto flex max-w-[var(--gh-max)] items-center gap-6 px-5 pt-4 sm:px-8 sm:pt-6">
        <Link href={withVisitor(ROUTES.home, visitor)} className="flex shrink-0 items-center gap-2.5 py-2">
          {/* The Golden hour badge (studio/camphawk-round2, logo picks): CampHawk's badge with a warm sky. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/private/camphawk/round2/badge-golden-80.webp" srcSet="/private/camphawk/round2/badge-golden-80.webp 2x, /private/camphawk/round2/badge-golden-120.webp 3x" alt="" width={40} height={40} decoding="async" className="size-10 shrink-0 select-none" draggable={false} />
          <span translate="no" className="whitespace-nowrap font-ch-display text-[22px] font-extrabold tracking-[-.025em] text-ch-paper">CampHawk</span>
        </Link>
        <nav aria-label="Main" className="hidden flex-1 gap-1 md:flex">
          {TABS.map((t) => (
            <Link key={t.tab} href={withVisitor(t.href, visitor)} aria-current={current === t.tab ? "page" : undefined} className={cx("whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-[15px] font-bold hover:bg-ch-white/10 hover:text-ch-white", current === t.tab ? "bg-ch-white/10 text-ch-white underline decoration-2 underline-offset-[6px]" : "text-ch-line")}>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          {hasAccount(visitor) ? (
            <span className="grid size-9 place-items-center rounded-full bg-ch-paper text-ch-meta font-extrabold text-ch-forest"><span aria-hidden="true">TF</span><span className="sr-only">Account (signed in)</span></span>
          ) : (
            <>
              <a href="#" className="whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[15px] font-bold text-ch-paper hover:bg-ch-white/10">Sign in</a>
              {/* A wrapper hides it on phones: `hidden` on the link itself loses to the button's inline-flex. */}
              {visitor === "signed-out" && <span className="hidden sm:contents"><a href="#" className={buttonClasses({ variant: "paper", size: "sm", className: "min-h-11 whitespace-nowrap px-4" })}>Sign up</a></span>}
            </>
          )}
        </div>
      </div>
      {/* Phone: the three tabs as a quiet row under the brand. */}
      <nav aria-label="Main" className="mx-auto flex max-w-[var(--gh-max)] gap-1 px-3 md:hidden">
        {TABS.map((t) => (
          <Link key={t.tab} href={withVisitor(t.href, visitor)} aria-current={current === t.tab ? "page" : undefined} className={cx("flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-[10px] text-[13.5px] font-bold hover:bg-ch-white/10", current === t.tab ? "bg-ch-white/10 text-ch-white underline decoration-2 underline-offset-[5px]" : "text-ch-line")}>
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** The forest footer, same links as CampHawk's. */
const FOOTER_HREF: Record<(typeof FOOTER_LINKS)[number], string> = {
  Support: ROUTES.support,
  "Data sources": ROUTES.sources,
  Terms: ROUTES.terms,
  Privacy: ROUTES.privacy,
};

export function GhFooter({ visitor = "signed-out" }: { visitor?: Visitor }) {
  return (
    <footer className="bg-ch-forest">
        <div className="mx-auto flex max-w-[var(--gh-max)] flex-wrap items-center justify-between gap-3 px-5 py-7 text-[14px] text-ch-line sm:px-8">
          <span>© 2026 CampHawk</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-1">
            {FOOTER_LINKS.map((l) => <Link key={l} href={withVisitor(FOOTER_HREF[l], visitor)} className="flex min-h-11 items-center px-2 hover:text-ch-white hover:underline">{l}</Link>)}
          </nav>
        </div>
    </footer>
  );
}

/** The lab bar's way between Golden hour screens (the header tabs cover three of them). */
export type Screen = "home" | "explore" | "campground" | "new" | "watches" | "other";
const SCREENS: ReadonlyArray<{ screen: Screen; label: string; href: string }> = [
  { screen: "home", label: "Home", href: ROUTES.home },
  { screen: "explore", label: "Explore", href: ROUTES.explore },
  { screen: "campground", label: "Campground", href: ROUTES.campground },
  { screen: "new", label: "New watch", href: ROUTES.newWatch },
  { screen: "watches", label: "Watches", href: ROUTES.watches },
];

export function ScreenLinks({ visitor, current = "home" }: { visitor: Visitor; current?: Screen }) {
  return (
    <nav aria-label="Golden hour screens" className="flex flex-wrap items-center gap-x-1">
      <span aria-hidden="true" className="pr-1 font-bold">Screens</span>
      {SCREENS.map((s) => (
        <Link
          key={s.screen}
          href={withVisitor(s.href, visitor)}
          aria-current={current === s.screen ? "page" : undefined}
          className={cx("flex min-h-11 items-center whitespace-nowrap rounded-ch-chip px-2.5", current === s.screen ? "bg-ch-white/15 font-bold underline underline-offset-4" : "underline-offset-2 hover:underline")}
        >
          {s.label}
        </Link>
      ))}
      <Link href={withVisitor(ROUTES.screens, visitor)} className="flex min-h-11 items-center whitespace-nowrap rounded-ch-chip px-2.5 font-bold underline underline-offset-2 hover:no-underline">
        All screens
      </Link>
    </nav>
  );
}
