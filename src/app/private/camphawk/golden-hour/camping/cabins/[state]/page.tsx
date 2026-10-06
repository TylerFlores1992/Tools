import type { Metadata, Viewport } from "next";
import { TypeStatePage } from "@/lab/camphawk/round2/pages/Camping";
import { regionBySlug, typeRegionSlugs } from "@/lab/camphawk/round2/pages/camping-data";

// One page per state or province with at least five campgrounds with this kind of site; any
// other address is a real 404, as in CampHawk (never a thin "nothing here" page).
export const dynamicParams = false;
export const generateStaticParams = () => typeRegionSlugs("cabins").map((state) => ({ state }));

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params;
  return { title: `CampHawk lab · ${regionBySlug(state)?.name ?? "Not found"} Campgrounds with Cabins`, robots: { index: false, follow: false } };
}

// The phone's browser bar matches the page's forest top and bottom (CampHawk's ch-forest).
export const viewport: Viewport = { themeColor: "#24382A" };

export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  return <TypeStatePage type="cabins" slug={state} />;
}
