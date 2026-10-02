import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

// Phase 3 placeholder: correct tokens, type and structure, no hero media yet.
// The full hero (film, wolf, choreography) is built in Phase 4.
export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — ${SITE.headline.join(" ")}` },
  robots: { index: true, follow: true },
};

export default function Home() {
  return (
    <main id="main" className="theme-night relative flex min-h-dvh flex-col justify-end bg-bg px-5 pb-16 text-ink sm:px-12 sm:pb-20">
      <p className="font-mono text-label uppercase text-ink-2">{SITE.domain}</p>
      <h1 className="mt-4 text-display font-normal">
        {SITE.headline[0]}
        <br />
        <span className="text-ember">{SITE.headline[1]}</span>
      </h1>
      <p className="mt-6 max-w-[42ch] text-lede text-ink-2">
        {SITE.description} Made after dark, built to last.
      </p>
      <Link
        href="/workshop"
        className="mt-8 inline-flex w-fit items-center gap-3 rounded-btn bg-primary px-6 py-4 text-body font-medium text-on-primary transition-transform duration-150 ease-out active:scale-[0.98]"
      >
        Enter the workshop <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
