import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { SiteMaps } from "@/lab/camphawk/round2/admin/SiteMaps";

// Private (src/proxy.ts) and never indexed. A lab mock of a CampHawk admin section.
export const metadata: Metadata = {
  title: "CampHawk lab · Site maps (admin)",
  robots: { index: false, follow: false },
};

// The phone's browser bar matches the admin's forest header.
export const viewport: Viewport = { themeColor: "#24382A" };

export default function SiteMapsPage() {
  // useSearchParams needs a Suspense boundary on a statically rendered page.
  return (
    <Suspense>
      <SiteMaps />
    </Suspense>
  );
}
