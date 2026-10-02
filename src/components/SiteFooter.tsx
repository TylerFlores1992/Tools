import Link from "next/link";
import { SITE } from "@/lib/site";

const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1280px] flex-col 3xl:max-w-[1600px] gap-3 px-5 py-8 font-mono text-label uppercase text-muted sm:flex-row sm:items-center sm:justify-between sm:px-12">
        <span>© {YEAR} {SITE.name}</span>
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/workshop" className="hover:text-ink">Workshop</Link>
          <span>{SITE.domain}</span>
        </nav>
      </div>
    </footer>
  );
}
