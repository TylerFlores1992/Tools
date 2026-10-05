import type { Metadata } from "next";
import { HomeLab } from "@/lab/camphawk/HomeLab";
import { toLook } from "@/lab/camphawk/looks";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab · Home",
  robots: { index: false, follow: false },
};

// ?look=<id> opens a look mockup (src/lab/camphawk/looks.ts); anything else shows the current design.
export default async function CampHawkLabHome({ searchParams }: { searchParams: Promise<{ look?: string | string[] }> }) {
  return <HomeLab initialLook={toLook((await searchParams).look)} />;
}
