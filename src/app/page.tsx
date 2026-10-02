import type { Metadata } from "next";
import { HeroFilm } from "@/components/HeroFilm";
import { PageTransition } from "@/components/PageTransition";
import { Arrow, LinkButton } from "@/components/Button";
import { Label } from "@/components/Label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — ${SITE.headline.join(" ")}` },
  description: SITE.description,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function Home() {
  return (
    <div className="theme-night bg-bg text-ink">
      <main id="main" className="relative isolate flex min-h-svh flex-col overflow-hidden">
        <HeroFilm />
        {/* Scrims: text sits on these, never straight on the film (contrast is checked in screenshots). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[62%] bg-linear-to-b from-transparent via-bg/60 to-bg/95" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-bg/70 to-transparent" />

        <SiteHeader current="/" overlay />

        <PageTransition>
        <div className="mt-auto px-5 pb-12 sm:px-12 sm:pb-16 3xl:px-16 3xl:pb-24">
          <div className="max-w-[min(92vw,900px)]">
            <Label rule className="rise [--d:300ms]" >{SITE.domain}</Label>
            <h1 className="mt-5 text-display font-normal font-stretch-[104%] text-balance">
              <span className="rise block [--d:450ms]" data-contrast-check>{SITE.headline[0]}</span>
              <span className="rise block text-ember [--d:600ms]" data-contrast-check>{SITE.headline[1]}</span>
            </h1>
            <p className="rise mt-6 max-w-[42ch] text-lede text-ink-2 [--d:800ms]" data-contrast-check>
              {SITE.description} Made after dark, built to last.
            </p>
            <div className="rise mt-9 [--d:950ms]">
              <LinkButton href="/workshop" className="group min-h-13 px-7 3xl:min-h-16 3xl:px-9 3xl:text-lede">
                Enter the workshop <Arrow className="transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </LinkButton>
            </div>
          </div>
        </div>
        </PageTransition>
      </main>
      <SiteFooter />
    </div>
  );
}
