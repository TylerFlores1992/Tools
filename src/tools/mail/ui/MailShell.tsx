import Link from "next/link";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const TABS = [
  { href: "/private/mail", label: "Today" },
  { href: "/private/mail/settings", label: "Accounts & rules" },
] as const;

export type MailTab = (typeof TABS)[number]["href"];

export function MailShell({ current, children }: { current: MailTab; children: ReactNode }) {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span className="text-ink-2">Morning Mail</span>
        </nav>
        <nav aria-label="Morning Mail" className="mt-4 overflow-x-auto">
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
