import type { Metadata, Viewport } from "next";
import { StatePage } from "@/lab/camphawk/round2/pages/Camping";
import { regionBySlug, regionSlugs } from "@/lab/camphawk/round2/pages/camping-data";

// One page per state or province with at least five campgrounds; any other address is a real
// 404, as in CampHawk. The static siblings (cabins, yurts, group-camping, hardest-to-book) win.
export const dynamicParams = false;
export const generateStaticParams = () => regionSlugs().map((state) => ({ state }));

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params;
  return { title: `CampHawk lab · Campgrounds in ${regionBySlug(state)?.name ?? "Not found"}`, robots: { index: false, follow: false } };
}

// The phone's browser bar matches the page's forest top and bottom (CampHawk's ch-forest).
export const viewport: Viewport = { themeColor: "#24382A" };

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  return <StatePage slug={state} />;
}
