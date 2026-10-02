import type { Metadata } from "next";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TOOLS, toolHref, type Tool } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Workshop",
  description: "Every tool in the workshop: rigging calculators, study decks and campsite alerts.",
  alternates: { canonical: "/workshop" },
  robots: { index: true, follow: true },
};

const live = TOOLS.filter((t) => t.status === "live").length;
const building = TOOLS.length - live;

function Status({ t }: { t: Tool }) {
  if (t.status === "building") return <span className="inline-flex items-center gap-2 text-muted"><span aria-hidden="true">◌</span> Building</span>;
  if (t.tier === 3) return <span className="inline-flex items-center gap-2 text-ink-2"><span aria-hidden="true">↗</span> Own site</span>;
  return <span className="inline-flex items-center gap-2 text-ice"><span aria-hidden="true">●</span> Live</span>;
}

function Row({ t, n }: { t: Tool; n: number }) {
  const inner = (
    <>
      <span className="font-mono text-label text-muted">{String(n).padStart(3, "0")}</span>
      <span>
        <span className="block text-h3 font-medium tracking-[-0.015em] text-ink">{t.name}</span>
        <span className="mt-1.5 block max-w-[52ch] text-ink-2">{t.summary}</span>
      </span>
      <span className="font-mono text-label uppercase text-muted">{t.kind}</span>
      <span className="font-mono text-label uppercase"><Status t={t} /></span>
      <span aria-hidden="true" className="hidden text-h3 text-muted transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-ember md:block">
        {t.status === "building" ? "" : t.tier === 3 ? "↗" : "→"}
      </span>
    </>
  );
  const cls = "group grid gap-x-8 gap-y-3 py-7 md:grid-cols-[56px_minmax(0,1fr)_200px_140px_24px] md:items-baseline";
  if (t.status === "building") return <li className={cls}>{inner}</li>;
  const href = toolHref(t);
  return (
    <li>
      {t.tier === 3 ? (
        <a href={href} className={`${cls} rounded-card hover:bg-surface/60`}>{inner}</a>
      ) : (
        <Link href={href} className={`${cls} rounded-card hover:bg-surface/60`}>{inner}</Link>
      )}
    </li>
  );
}

export default function Workshop() {
  return (
    <>
      <SiteHeader current="/workshop" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-10 sm:px-12 sm:pt-16 3xl:max-w-[1600px]">
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
        <ol className="divide-y divide-line">
          {TOOLS.map((t, i) => <Row key={t.slug} t={t} n={i + 1} />)}
        </ol>
      </PageTransition>
</main>
      <SiteFooter />
    </>
  );
}
