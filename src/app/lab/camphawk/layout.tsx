import type { ReactNode } from "react";
import { Bitter, Nunito_Sans } from "next/font/google";

// CampHawk's own faces, for the lab only (next/font self-hosts them at build time). The
// wrapper switches every page under /lab/camphawk to CampHawk's light, paper-and-pine look.
// The whole segment sits behind src/proxy.ts. Metadata and robots live on each page.
const bitter = Bitter({ subsets: ["latin"], variable: "--font-bitter", display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap" });

export default function CampHawkLabLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`camphawk ${bitter.variable} ${nunito.variable} relative isolate min-h-dvh bg-ch-paper font-ch-body text-ch-ink antialiased`}>
      {children}
    </div>
  );
}
