import Link from "next/link";
import { SITE } from "@/lib/site";
import { cx } from "./cx";
import { EDGE, WRAP } from "./wrap";
import { Year } from "./Year";

// The year at build time; <Year> replaces it with the visitor's year if the build is older.
const BUILT = new Date().getFullYear();

/** `wide` runs edge to edge, for the home page, whose hero does too. `mt-auto` keeps it at the
 *  foot of the window on short pages (the body is a flex column). */
export function SiteFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className="mt-auto border-t border-line">
      <div className={cx("flex flex-col gap-3 py-8 font-mono text-label uppercase text-muted sm:flex-row sm:items-center sm:justify-between", wide ? EDGE : WRAP)}>
        <span>© <Year built={BUILT} /> {SITE.name}</span>
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/workshop" className="-my-3 inline-flex min-h-11 items-center hover:text-ink active:text-ink">Workshop</Link>
        </nav>
      </div>
    </footer>
  );
}
