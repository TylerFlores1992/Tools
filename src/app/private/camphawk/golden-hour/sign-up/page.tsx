import type { Metadata, Viewport } from "next";
import { SignUp } from "@/lab/camphawk/round2/pages/Auth";

// Private (src/proxy.ts) and never indexed.
export const metadata: Metadata = {
  title: "CampHawk lab \u00b7 Sign up",
  robots: { index: false, follow: false },
};

// The phone's browser bar matches the page's forest top and bottom (CampHawk's ch-forest).
export const viewport: Viewport = { themeColor: "#24382A" };

export default function SignUpPage() {
  return <SignUp />;
}
