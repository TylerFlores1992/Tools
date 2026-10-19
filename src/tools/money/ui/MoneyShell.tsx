import Link from "next/link";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { cx } from "@/components/cx";

const TABS = [
  { href: "/private/money", label: "Overview" },
  { href: "/private/money/budget", label: "Budget" },
  { href: "/private/money/transactions", label: "Transactions" },
  { href: "/private/money/settings", label: "Settings" },
] as const;

export type MoneyTab = (typeof TABS)[number]["href"];

/** Header, breadcrumb back to Private, the three money tabs, footer. */
export function MoneyShell({ current, children }: { current: MoneyTab; children: ReactNode }) {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span className="text-ink-2">Money</span>
        </nav>
        <nav aria-label="Money" className="mt-4 overflow-x-auto">
          <ul className="inline-flex gap-1 rounded-full border border-line bg-surface p-1">
            {TABS.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={current === t.href ? "page" : undefined}
                  className="flex min-h-10 items-center rounded-full px-4 text-small whitespace-nowrap text-ink-2 transition-colors duration-150 hover:text-ink aria-[current=page]:bg-primary aria-[current=page]:text-on-primary"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <PageTransition>
          <div className="mt-8">{children}</div>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}

/** A small word tag (owner, pending, cadence). Words, never colour. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-tag border border-line-2 px-2 py-0.5 font-mono text-label uppercase text-ink-2", className)}>
      {children}
    </span>
  );
}

/** Link styled as a pill choice (filters that live in the URL, so they work without JavaScript). */
export function ChoiceLink({ href, on, children }: { href: string; on: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={cx("flex min-h-10 items-center gap-2 rounded-full px-4 text-small whitespace-nowrap transition-colors duration-150", on ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink")}
    >
      {on && <span aria-hidden="true">✓</span>}
      {children}
    </Link>
  );
}

export const OWNER_LABEL = { mine: "Mine", joint: "Joint", hers: "Hers" } as const;
