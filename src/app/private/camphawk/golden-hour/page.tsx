import type { Metadata, Viewport } from "next";
import { GoldenHour } from "@/lab/camphawk/round2/GoldenHour";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab · Golden hour",
  robots: { index: false, follow: false },
};

// The phone's browser bar matches the page's forest top and bottom (CampHawk's ch-forest).
export const viewport: Viewport = { themeColor: "#24382A" };

export default function GoldenHourPage() {
  return <GoldenHour />;
}
