import type { Metadata } from "next";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BridleCalculator } from "@/tools/bridle/BridleCalculator";
import { SITE } from "@/lib/site";
import { toolBySlug } from "@/lib/tools";

const tool = toolBySlug("bridle-calculator");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
  alternates: { canonical: `/workshop/${tool.slug}` },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: `${tool.name} calculator`,
  description: tool.summary,
  url: `${SITE.url}/workshop/${tool.slug}`,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function BridleCalculatorPage() {
  return (
    <>
      <SiteHeader current="/workshop" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-20 pt-6 sm:px-12 sm:pt-10 3xl:max-w-[1600px]">
<PageTransition>
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/workshop" className="hover:text-ink">Workshop</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span className="text-ink-2">{tool.name}</span>
        </nav>
        <header className="mt-6 max-w-[64ch]">
          <Label>Rigging · Calculator</Label>
          <h1 className="mt-3 text-title font-normal">{tool.name}</h1>
          <p className="mt-4 text-lede text-ink-2">
            Drag the bridle point or type the measurements. Leg lengths, tensions and angles update as you go, with the math worked by hand underneath.
          </p>
        </header>
        <div className="mt-10">
          <BridleCalculator />
        </div>
        <aside className="mt-8 max-w-[72ch] border-t border-line pt-5 text-small text-muted">
          Tensions are static: they ignore the weight of the legs and hardware, and any shock loading. Check every real rig against your rigging references and a qualified rigger before you hang anything.
        </aside>
      </PageTransition>
</main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
