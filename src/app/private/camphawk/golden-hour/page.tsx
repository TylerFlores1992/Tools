import type { Metadata } from "next";
import { GoldenHour } from "@/lab/camphawk/round2/GoldenHour";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab · Golden hour",
  robots: { index: false, follow: false },
};

export default function GoldenHourPage() {
  return <GoldenHour />;
}
