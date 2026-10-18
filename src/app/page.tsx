import type { Metadata } from "next";
import { HeroArt } from "@/components/HeroArt";
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
        <HeroArt />
        {/* Scrims: text sits on these, never straight on the art (contrast is checked in screenshots).
            Landscape: a left scrim under the type, so the wolf keeps its light, plus a short floor
            into the footer. Phones (`tall`): the art stops at 72% and fades into solid night,
            and a thin left edge sinks a stray warm spark so the eye stays the one highlight. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-[64%] bg-linear-to-r from-bg/95 via-bg/85 via-50% to-transparent tall:hidden" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-b from-transparent to-bg tall:hidden" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[38%] bottom-0 -z-10 hidden bg-linear-to-b from-transparent via-bg/80 via-35% to-bg to-55% tall:block" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 -z-10 hidden w-[22%] bg-linear-to-r from-bg/70 to-transparent tall:block" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-bg/70 to-transparent" />

        <SiteHeader current="/" overlay />

        <PageTransition>
        <div className="mt-auto px-5 pb-12 sm:px-12 sm:pb-16 3xl:px-16 3xl:pb-24">
          <div className="max-w-[min(92vw,900px)]">
            <Label rule className="rise [--d:80ms]" >{SITE.domain}</Label>
            <h1 className="mt-5 text-display font-normal font-stretch-[104%] text-balance">
              <span className="rise block w-fit [--d:160ms]" data-contrast-check>{SITE.headline[0]}</span>
              <span className="rise block w-fit text-ember [--d:240ms]" data-contrast-check>{SITE.headline[1]}</span>
            </h1>
            <p className="rise mt-6 max-w-[42ch] text-lede text-ink-2 [--d:340ms]" data-contrast-check>
              {SITE.description} Made after dark, built to last.
            </p>
            <div className="rise mt-9 [--d:440ms]">
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
