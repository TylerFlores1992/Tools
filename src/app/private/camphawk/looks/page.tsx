import type { Metadata } from "next";
import Link from "next/link";
import { LOOKS } from "@/lab/camphawk/looks";
import { LookPicture } from "@/lab/camphawk/LookScene";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab · Looks",
  robots: { index: false, follow: false },
};

const lookHref = (id: string) => (id === "current" ? "/private/camphawk" : `/private/camphawk?look=${id}`);

/** Every look side by side: what it is, what it changes, and a way in. */
export default function CampHawkLooks() {
  return (
    <div className="look-grain min-h-dvh">
      <div className="bg-ch-forest text-ch-white">
        <nav aria-label="Breadcrumb" className="mx-auto flex max-w-[var(--ch-max)] flex-wrap items-center gap-x-2 px-5 py-2.5 text-ch-meta">
          <Link href="/private" className="flex min-h-11 items-center gap-1.5 underline-offset-2 hover:underline">
            <span aria-hidden="true">←</span> Private
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/private/camphawk" className="flex min-h-11 items-center font-bold underline-offset-2 hover:underline">CampHawk lab</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Looks</span>
        </nav>
      </div>
      <main id="main" className="mx-auto max-w-[var(--ch-max)] px-5 pb-16 pt-10 sm:pt-14">
        <h1 className="font-ch-display text-[clamp(28px,4.5vw,40px)] font-extrabold leading-[1.05] tracking-[-.03em]">New looks for the home page</h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ch-ink-2">
          The same page, words and controls in each; only the backdrop and the finish change. All use CampHawk&apos;s own palette.
          Open one, then switch with <strong>Look</strong> in the lab bar.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {LOOKS.map((look) => (
            <li key={look.id} className="overflow-hidden rounded-ch-card border border-ch-line bg-ch-card shadow-ch-card">
              <Link href={lookHref(look.id)} className="group block h-full">
                <div className="relative aspect-[2400/1100] overflow-hidden bg-ch-shell">
                  {look.art ? (
                    <LookPicture look={look} className="look-thumb" />
                  ) : (
                    <span aria-hidden="true" className="absolute inset-0 bg-cover" style={{ backgroundImage: "url('/private/camphawk/hero-bg.webp')", backgroundPosition: "center 22%" }}>
                      <span className="absolute inset-0 bg-ch-paper/45" />
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="flex items-baseline justify-between gap-3 font-ch-display text-ch-h font-bold">
                    {look.name}
                    <span className="text-ch-meta font-bold text-ch-green group-hover:underline">Open <span aria-hidden="true">→</span></span>
                  </h2>
                  <p className="mt-1 text-ch-body leading-relaxed text-ch-ink-2">{look.blurb}</p>
                  <p className="mt-1.5 text-ch-fine leading-normal text-ch-muted">{look.finish}</p>
                  {look.departs && (
                    <p className="mt-2 rounded-ch-tag bg-ch-ochre-soft px-2 py-1.5 text-ch-fine leading-normal text-ch-ochre-ink">
                      <strong>Note:</strong> {look.departs}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
