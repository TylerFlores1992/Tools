import type { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolList } from "@/components/ToolList";
import { WRAP } from "@/components/wrap";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Workshop",
  description: "Every tool in the workshop: rigging calculators, study decks and campsite alerts.",
  alternates: { canonical: "/workshop" },
  robots: { index: true, follow: true },
};

const live = TOOLS.filter((t) => t.status === "live").length;
const building = TOOLS.length - live;

export default function Workshop() {
  return (
    <>
      <SiteHeader current="/workshop" />
      <main id="main" className={`${WRAP} pb-24 pt-10 sm:pt-16`}>
<PageTransition>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-2 pb-6">
          <div>
            <Label>The workshop</Label>
            <h1 className="mt-3 text-title font-normal">Tools</h1>
          </div>
          <p className="font-mono text-label uppercase text-muted">
            {live} live{building > 0 && ` · ${building} building`}
          </p>
        </div>
        <ToolList tools={TOOLS} />
      </PageTransition>
</main>
      <SiteFooter />
    </>
  );
}
