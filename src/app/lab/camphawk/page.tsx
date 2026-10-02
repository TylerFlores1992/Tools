import type { Metadata } from "next";
import { HomeLab } from "@/lab/camphawk/HomeLab";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab · Home",
  robots: { index: false, follow: false },
};

export default function CampHawkLabHome() {
  return <HomeLab />;
}
