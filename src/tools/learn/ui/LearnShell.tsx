import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { AppTabs } from "@/components/AppTabs";
import { State } from "@/components/State";
import { TryAgain } from "@/tools/money/ui/TryAgain";

const TABS = [
  { href: "/private/learn", label: "Lessons" },
  { href: "/private/learn/review", label: "Review" },
  { href: "/private/learn/method", label: "How it teaches" },
] as const;

export type LearnTab = (typeof TABS)[number]["href"] | null;

export function LearnShell({ current, children, crumb }: { current?: LearnTab; children: ReactNode; crumb?: string }) {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center text-small text-muted">
          <Link href="/private" className="inline-flex min-h-11 items-center rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          {crumb ? (
            <>
              <Link href="/private/learn" className="inline-flex min-h-11 items-center rounded-tag underline-offset-4 hover:text-ink hover:underline">Learn</Link>
              <span aria-hidden="true" className="px-2">/</span>
              <span className="text-ink-2">{crumb}</span>
            </>
          ) : (
            <span className="text-ink-2">Learn</span>
          )}
        </nav>
        {current !== null && <AppTabs label="Learn" tabs={TABS} current={current} />}
        <PageTransition>
          <div className={current !== null ? "mt-8" : "mt-6"}>{children}</div>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}

export function LearnNotConfigured() {
  return (
    <Card className="max-w-[640px]">
      <State kind="note">Learn isn&rsquo;t set up on this site yet, so it can&rsquo;t keep your progress.</State>
      <p className="mt-3 text-body text-ink-2">Tyler needs to finish setting it up.</p>
      <details className="group mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-small text-ink-2 hover:text-ink"><span aria-hidden="true" className="mr-1.5 inline-block transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none">›</span>For Tyler</summary>
        <p className="mt-1 text-small text-ink-2">
          Learn keeps progress in the same database as Money (<code className="font-mono">MONEY_DATABASE_URL</code>). Setup is in{" "}
          <code className="font-mono">docs/LEARN.md</code>.
        </p>
      </details>
    </Card>
  );
}

export function LearnUnreachable() {
  return (
    <Card className="max-w-[640px]">
      <State kind="wrong">Couldn&rsquo;t reach the progress database. Try again in a minute.</State>
      <TryAgain className="mt-4" />
    </Card>
  );
}
