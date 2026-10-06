import type { Metadata, Viewport } from "next";
import { Sources } from "@/lab/camphawk/round2/pages/Tier4";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab \u00b7 Data sources",
  robots: { index: false, follow: false },
};

// The phone's browser bar matches the page's forest top and bottom (CampHawk's ch-forest).
export const viewport: Viewport = { themeColor: "#24382A" };

export default function SourcesPage() {
  return <Sources />;
}
