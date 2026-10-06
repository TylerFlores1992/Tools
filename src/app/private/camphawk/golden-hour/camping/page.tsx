import type { Metadata, Viewport } from "next";
import { CampingHub } from "@/lab/camphawk/round2/pages/Camping";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = { title: "CampHawk lab · Camping by state", robots: { index: false, follow: false } };

// The phone's browser bar matches the page's forest top and bottom (CampHawk's ch-forest).
export const viewport: Viewport = { themeColor: "#24382A" };

export default function Page() {
  return <CampingHub />;
}
