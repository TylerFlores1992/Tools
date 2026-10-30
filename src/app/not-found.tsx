import type { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";
import { Arrow, LinkButton } from "@/components/Button";
import { Label } from "@/components/Label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WRAP } from "@/components/wrap";

export const metadata: Metadata = { title: "Not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <>
      <SiteHeader current={null} />
      <main id="main" className={`${WRAP} flex flex-1 items-center pb-24 pt-10 sm:pt-16`}>
        <PageTransition>
          <div>
            <Label>Error 404</Label>
            <h1 className="mt-3 text-title font-normal">Lost the trail.</h1>
            <p className="mt-4 max-w-[46ch] text-lede text-ink-2">This page doesn’t exist, or it moved. The tools are all in the workshop.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <LinkButton href="/workshop" className="group">
                Go to the workshop <Arrow className="transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </LinkButton>
              <LinkButton href="/" variant="quiet">Back home</LinkButton>
            </div>
          </div>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}
