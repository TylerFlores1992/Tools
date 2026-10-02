import type { Metadata } from "next";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { Arrow, Button } from "@/components/Button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PRIVATE_PROJECTS } from "@/lib/private";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Private",
  description: "Work in progress.",
  robots: { index: false, follow: false },
};

export default function PrivateHome() {
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-10 sm:px-12 sm:pt-16 3xl:max-w-[1600px]">
        <PageTransition>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-2 pb-6">
            <div>
              <Label>Signed in</Label>
              <h1 className="mt-3 text-title font-normal">Private</h1>
              <p className="mt-4 max-w-[52ch] text-lede text-ink-2">Work in progress. New projects land here before they go public.</p>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="quiet">Sign out</Button>
            </form>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRIVATE_PROJECTS.map((p) => (
              <li key={p.slug}>
                <Link href={p.href} className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-control hover:bg-surface-2 sm:p-6">
                  <span className="font-mono text-label uppercase text-muted">{p.stage}</span>
                  <span className="mt-3 flex items-center justify-between gap-4 text-h3 font-medium text-ink">
                    {p.name}
                    <Arrow className="shrink-0 text-muted transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-ember" />
                  </span>
                  <span className="mt-2 text-body text-ink-2">{p.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-small text-muted">
            {PRIVATE_PROJECTS.length} {PRIVATE_PROJECTS.length === 1 ? "project" : "projects"} · visible only with the password.
          </p>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}
