"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cx } from "@/components/cx";
import { buttonClasses } from "./ui";
import type { Visitor } from "./data";

// Ported from campsite-finder src/components/v2/V2Nav.tsx (2026-10-02), minus Clerk and the
// admin menu: the account controls follow the lab's visitor switch instead. Links stay inside
// the lab (#), so nothing here can reach the real app.
const LINKS = ["Watches", "New watch", "Explore"] as const;
const COLLAPSE_AT = 96, EXPAND_AT = 8, HEADER_ANIM_MS = 260;

function AccountControl({ visitor, compact }: { visitor: Visitor; compact?: boolean }) {
  if (visitor === "subscriber") {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-ch-green-soft text-ch-meta font-extrabold text-ch-green-deep ring-2 ring-ch-card" aria-label="Account (signed in)">
        TF
      </span>
    );
  }
  return (
    <>
      <a
        href="#"
        className={cx(
          "cursor-pointer whitespace-nowrap rounded-[9px] px-2.5 py-1.5 text-[13px] font-bold",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green",
          compact ? "bg-ch-card/90 text-ch-ink-2 shadow-ch-card backdrop-blur hover:bg-ch-card" : "text-ch-ink-2 hover:bg-ch-green-soft",
        )}
      >
        Sign in
      </a>
      {visitor === "signed-out" && (
        <span className="hidden sm:contents">
          <a href="#" className={buttonClasses({ size: "sm", className: "whitespace-nowrap" })}>Sign up</a>
        </span>
      )}
    </>
  );
}

export function Nav({ visitor }: { visitor: Visitor }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let lockedUntil = 0;
    const onScroll = () => {
      if (performance.now() < lockedUntil) return;
      const y = window.scrollY;
      setCollapsed((prev) => {
        const next = prev ? y > EXPAND_AT : y > COLLAPSE_AT;
        if (next !== prev) lockedUntil = performance.now() + HEADER_ANIM_MS;
        return next;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Phone: the painted band and the tabs pin together; scrolling shrinks the band. */}
      <div className="sticky top-0 z-30 sm:hidden">
        <div
          className="relative overflow-hidden bg-ch-forest transition-[height] duration-[260ms] ease-out motion-reduce:transition-none"
          style={{ height: `calc(${collapsed ? "var(--ch-header-min)" : "var(--ch-header)"} + env(safe-area-inset-top))`, paddingTop: "env(safe-area-inset-top)" }}
        >
          <Image
            src="/private/camphawk/app-header.jpg"
            alt="CampHawk — find your next adventure"
            width={900}
            height={295}
            unoptimized
            priority
            className={cx("size-full", collapsed ? "object-cover object-bottom" : "object-contain object-center")}
          />
          {collapsed && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-linear-to-l from-ch-forest via-ch-forest/85 to-transparent" />}
          <div className="absolute right-3 flex items-center gap-2" style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
            <AccountControl visitor={visitor} compact />
          </div>
        </div>
        <nav aria-label="Main" className="flex border-b border-ch-line bg-ch-card">
          {LINKS.map((label) => (
            <a
              key={label}
              href="#"
              className="-mb-px flex-1 whitespace-nowrap border-b-[2.5px] border-transparent px-1 pb-2.5 pt-3 text-center text-[11.5px] font-bold text-ch-muted transition-colors focus-visible:outline-2 focus-visible:-outline-offset-[3px] focus-visible:outline-ch-green motion-reduce:transition-none min-[360px]:text-[12.5px]"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      {/* Desktop */}
      <header className="sticky top-0 z-20 hidden border-b border-ch-line bg-ch-card/95 backdrop-blur sm:block">
        <div className="mx-auto flex max-w-[var(--ch-max)] items-center gap-6 px-5">
          <a href="#" className="flex shrink-0 items-center gap-2.5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green">
            <Image src="/private/camphawk/logo-badge.png" alt="" width={38} height={38} unoptimized className="shrink-0 select-none object-contain" draggable={false} />
            <span className="whitespace-nowrap font-ch-display text-[24px] font-extrabold tracking-[-.025em]">CampHawk</span>
          </a>
          <nav aria-label="Main" className="flex flex-1 gap-1">
            {LINKS.map((label) => (
              <a key={label} href="#" className="relative whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-[14.5px] font-bold text-ch-muted transition-colors hover:bg-ch-green-soft hover:text-ch-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green motion-reduce:transition-none">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <AccountControl visitor={visitor} />
          </div>
        </div>
      </header>
    </>
  );
}
