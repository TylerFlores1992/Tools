"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/cx";
import type { Visitor } from "../data";
import { LabBar } from "../LabBar";
import { ROUTES } from "./gates";
import { ScreenLinks } from "./GhChrome";
import { useVisitor, withVisitor } from "./labState";

// The frame for CampHawk's screens that sit outside the app's chrome on purpose: the one-tap
// action page, Claim and Connect. No tabs, no footer links: a credential or a hand-off shouldn't
// invite you away, and someone arriving from a push notification has no history to go back to.
// The badge is the one way home. On forest at the top, the work on a paper card below.
// `home` is where the badge goes: inside the app CampHawk sends it to search, never to the
// marketing page with prices.

export function BareFrame({
  page, controls, children, narrow = true, homeLabel = "CampHawk home", centered = true, lead,
}: {
  page: string;
  controls?: (ctx: { visitor: Visitor }) => ReactNode;
  children: (ctx: { visitor: Visitor }) => ReactNode;
  narrow?: boolean;
  homeLabel?: string;
  /** Center the badge over the card (every bare screen; the card is centered too). */
  centered?: boolean;
  /** One line of context on the forest, under the badge. */
  lead?: ReactNode;
}) {
  const [visitor, setVisitor] = useVisitor();
  const home = visitor === "app" ? ROUTES.explore : ROUTES.home;
  return (
    <div className="gh flex min-h-dvh flex-col bg-ch-paper">
      <LabBar page={page} visitor={visitor} onVisitor={setVisitor}>
        <ScreenLinks visitor={visitor} current="other" />
        {controls?.({ visitor })}
      </LabBar>
      <main id="main" className="flex-1">
        <div className="bg-ch-forest pb-24 pt-[max(env(safe-area-inset-top),24px)]">
          <div className={cx("mx-auto px-5", narrow ? "max-w-[30rem]" : "max-w-[44rem]", centered && "text-center")}>
            <Link href={withVisitor(home, visitor)} aria-label={homeLabel} className="inline-flex min-h-11 items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/private/camphawk/round2/badge-golden-80.webp" srcSet="/private/camphawk/round2/badge-golden-80.webp 2x, /private/camphawk/round2/badge-golden-120.webp 3x" alt="" width={40} height={40} className="size-10" />
              <span translate="no" className="font-ch-display text-[22px] font-extrabold tracking-[-.025em] text-ch-paper">CampHawk</span>
            </Link>
            {lead}
          </div>
        </div>
        <div className={cx("mx-auto -mt-16 px-5 pb-16", narrow ? "max-w-[30rem]" : "max-w-[44rem]")}>
          {children({ visitor })}
        </div>
      </main>
    </div>
  );
}

/** The card a bare screen does its work on. */
export function BareCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-ch-card border border-ch-line bg-ch-card p-5 shadow-ch-pop sm:p-7", className)}>{children}</div>;
}

/** A label/value list (HoldConfirm's summary box). */
export function Facts({ rows }: { rows: ReadonlyArray<readonly [string, ReactNode]> }) {
  return (
    <dl className="mt-4 divide-y divide-ch-line rounded-ch-input border border-ch-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-3">
          <dt className="text-[13px] font-extrabold text-ch-ink-2">{k}</dt>
          <dd className="text-right text-[16px] text-ch-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The "Beta" pill and its note: above the promise, on purpose. */
export function BetaNote({ className }: { className?: string }) {
  return (
    <p className={cx("flex items-start gap-2 text-[14px] leading-relaxed text-ch-ink-2", className)}>
      <span className="mt-0.5 shrink-0 rounded-full bg-ch-shell px-2 py-0.5 text-[12px] font-extrabold text-ch-ink-2">Beta</span>
      <span>8 AM holds are in beta. They have worked on real releases, and can still miss — set an alarm for the release time and be ready to book it yourself.</span>
    </p>
  );
}
