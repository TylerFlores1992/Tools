import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE } from "@/lib/site";

// Self-hosted variable fonts (OFL), subset to the characters and axis ranges the site uses
// (scripts/subset-fonts.sh): 40 KB for both. Licences sit beside the files in src/fonts/.
const mona = localFont({
  src: "../fonts/MonaSans-Variable.woff2",
  variable: "--font-mona",
  weight: "400 600",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "100% 104%" }],
  adjustFontFallback: "Arial",
});

const jetbrains = localFont({
  src: "../fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains",
  weight: "400 600",
  display: "swap",
  adjustFontFallback: false,
});

// Site-wide defaults only. `robots` is set per page, never here (see docs/CAMPHAWK-LESSONS.md).
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export const viewport: Viewport = {
  themeColor: "#05070e",
  colorScheme: "dark light",
};

// Applies a saved theme choice before first paint. With no choice saved, CSS follows the
// system setting. Runs inline in <head>; never read cookies()/headers() in this layout.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

// The launch intro: only when opened as the installed app, once per launch, never with reduced
// motion. Set before first paint so the page never flashes between Android's launch screen and it.
const LAUNCH_SCRIPT = `(function(){try{var m=function(q){return window.matchMedia&&matchMedia(q).matches};if(!(m("(display-mode: standalone)")||navigator.standalone))return;if(m("(prefers-reduced-motion: reduce)"))return;if(sessionStorage.getItem("launched"))return;sessionStorage.setItem("launched","1");document.documentElement.setAttribute("data-launch","")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mona.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          Skip to content
        </a>
        {children}
        {/* Hidden unless the launch script set data-launch; pure CSS, gone after 1.4 s. */}
        <div className="launch" aria-hidden="true">
          <div className="launch-art">
            <span className="launch-eye" />
          </div>
        </div>
      </body>
    </html>
  );
}
