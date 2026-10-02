import type { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { safeNext } from "@/lib/private-auth";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Private",
  description: "This part of the site is private.",
  robots: { index: false, follow: false },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  return (
    <>
      <SiteHeader current="/private" />
      <main id="main" className="mx-auto flex min-h-[70dvh] max-w-[1280px] items-center px-5 pb-20 pt-6 sm:px-12 sm:pt-10 3xl:max-w-[1600px]">
        <PageTransition>
          <div className="w-full">
            <Label>Private</Label>
            <h1 className="mt-3 text-title font-normal">Enter the password</h1>
            <p className="mt-4 max-w-[48ch] text-lede text-ink-2">This part of the workshop holds work in progress.</p>
            <div className="mt-8 max-w-[440px] rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
              <SignInForm next={next} />
            </div>
          </div>
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}
