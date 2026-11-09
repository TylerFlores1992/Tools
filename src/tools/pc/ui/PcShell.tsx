import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/** The frame for /private/pc: site header, breadcrumb back to Private, the heading and one card. */
export function PcShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span className="text-ink-2">Home PC</span>
        </nav>
        <PageTransition>
          <div className="mt-6 max-w-[760px]">
            <Label>Wake-on-LAN</Label>
            <h1 className="mt-3 text-title font-normal">Home PC</h1>
            <p className="mt-4 text-lede text-ink-2">Wake the main PC from here so Vectorworks can read out drawings and build rigs while you&rsquo;re away.</p>
            <Card className="mt-8">{children}</Card>
          </div>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}

