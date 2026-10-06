import type { Metadata } from "next";
import { TrailPoster } from "@/lab/camphawk/round2/TrailPoster";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab · Trail poster",
  robots: { index: false, follow: false },
};

export default function TrailPosterPage() {
  return <TrailPoster />;
}
