import type { Metadata, Viewport } from "next";
import { NewWatch } from "@/lab/camphawk/round2/NewWatch";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab · New watch",
  robots: { index: false, follow: false },
};

// The phone's browser bar matches the page's forest top and bottom (CampHawk's ch-forest).
export const viewport: Viewport = { themeColor: "#24382A" };

export default function NewWatchPage() {
  return <NewWatch />;
}
