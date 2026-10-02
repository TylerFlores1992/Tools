import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/tools";

// Phase 3 stub: the real index (dense table, ⌘K) is built in Phase 4.
export const metadata: Metadata = {
  title: "Workshop",
  description: "Every tool in the workshop.",
  robots: { index: true, follow: true },
};

export default function Workshop() {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-5 py-24 sm:px-12">
      <p className="font-mono text-label uppercase text-muted">The workshop</p>
      <h1 className="mt-3 text-title font-normal">Tools</h1>
      <ul className="mt-12 divide-y divide-line border-y border-line">
        {TOOLS.map((t) => (
          <li key={t.slug} className="grid gap-2 py-6 sm:grid-cols-[1fr_1.4fr]">
            <span className="text-h3 font-medium">{t.name}</span>
            <span className="text-ink-2">{t.summary}</span>
          </li>
        ))}
      </ul>
      <Link href="/" className="mt-10 inline-block text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink">
        Back home
      </Link>
    </main>
  );
}
