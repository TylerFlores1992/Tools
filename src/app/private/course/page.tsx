import type { Metadata } from "next";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { requirePrivate } from "@/lib/money/guard";
import { CoursePanel } from "@/tools/course/CoursePanel";

export const metadata: Metadata = {
  title: "Page Turner",
  description: "Runs a self-paced course on the home server and sends each question to your phone.",
  robots: { index: false, follow: false },
};

export default async function CoursePage() {
  await requirePrivate("/private/course");
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-4 sm:px-12 sm:pt-8 3xl:max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link href="/private" className="rounded-tag underline-offset-4 hover:text-ink hover:underline">Private</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span className="text-ink-2">Page Turner</span>
        </nav>
        <PageTransition>
          <h1 className="mt-6 text-title font-normal">Page Turner</h1>
          <p className="mt-3 max-w-[60ch] text-lede text-ink-2">Turns the pages of a course on the home server. When a question comes up, it stops and alerts your phone so you can answer it here.</p>
          <CoursePanel />
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}
