import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Unknown lab addresses: render the segment's not-found screen (404).
export const metadata: Metadata = { title: "CampHawk lab · Not found", robots: { index: false, follow: false } };

export default function Missing() {
  notFound();
}
