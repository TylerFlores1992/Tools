import Link from "next/link";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/** The frame for Top Movies: site header, breadcrumb back to Private, footer (as Recordings). */
export function MoviesShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span className="text-ink-2">Top Movies</span>
        </nav>
        <PageTransition>
          <div className="mt-6">{children}</div>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}
