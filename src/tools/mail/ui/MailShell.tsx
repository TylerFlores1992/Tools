import Link from "next/link";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { AppTabs } from "@/components/AppTabs";

const TABS = [
  { href: "/private/mail", label: "Today" },
  { href: "/private/mail/settings", label: "Accounts & rules" },
] as const;

export type MailTab = (typeof TABS)[number]["href"];

export function MailShell({ current, children }: { current?: MailTab; children: ReactNode }) {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span className="text-ink-2">Morning Mail</span>
        </nav>
        <AppTabs label="Morning Mail" tabs={TABS} current={current} />
        <PageTransition>
          <div className="mt-8">{children}</div>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}
