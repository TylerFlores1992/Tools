import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { MapLayouts } from "@/lab/camphawk/round2/admin/MapLayouts";

// Private (src/proxy.ts) and never indexed. Design comps for split listings and single units.
export const metadata: Metadata = {
  title: "CampHawk lab · Site map layouts",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#24382A" };

export default function MapLayoutsPage() {
  return (
    <Suspense>
      <MapLayouts />
    </Suspense>
  );
}
