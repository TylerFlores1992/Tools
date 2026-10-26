import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { State } from "@/components/State";

const TABS = [
  { href: "/private/learn", label: "Lessons" },
  { href: "/private/learn/review", label: "Review" },
  { href: "/private/learn/method", label: "How it teaches" },
] as const;

export type LearnTab = (typeof TABS)[number]["href"] | null;

export function LearnShell({ current, children, crumb }: { current: LearnTab; children: ReactNode; crumb?: string }) {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          {crumb ? (
            <>
              <Link href="/private/learn" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Learn</Link>
              <span aria-hidden="true" className="px-2">/</span>
              <span className="text-ink-2">{crumb}</span>
            </>
          ) : (
            <span className="text-ink-2">Learn</span>
          )}
        </nav>
        {current && (
          <nav aria-label="Learn" className="mt-4 overflow-x-auto">
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
        )}
        <PageTransition>
          <div className={current ? "mt-8" : "mt-6"}>{children}</div>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}

export function LearnNotConfigured() {
  return (
    <Card className="max-w-[640px]">
      <State kind="note">The progress database isn&rsquo;t connected to this site yet.</State>
      <p className="mt-3 text-body text-ink-2">
        Learn keeps progress in the same database as Money (<code className="font-mono text-small">MONEY_DATABASE_URL</code>). Setup is in{" "}
        <code className="font-mono text-small">docs/LEARN.md</code>.
      </p>
    </Card>
  );
}

export function LearnUnreachable() {
  return (
    <Card className="max-w-[640px]">
      <State kind="wrong">Couldn&rsquo;t reach the progress database. Try again in a minute.</State>
    </Card>
  );
}
