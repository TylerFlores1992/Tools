import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main id="main" className="theme-night flex min-h-dvh flex-col items-start justify-center bg-bg px-5 text-ink sm:px-12">
      <p className="font-mono text-label uppercase text-muted">404</p>
      <h1 className="mt-3 text-title font-normal">Lost the trail.</h1>
      <p className="mt-4 max-w-[46ch] text-lede text-ink-2">This page doesn’t exist, or it moved.</p>
      <Link href="/" className="mt-8 rounded-btn bg-primary px-6 py-4 font-medium text-on-primary">
        Back home
      </Link>
    </main>
  );
}
