import Image from "next/image";
import { buttonClasses } from "../ui";
import type { Visitor } from "../data";
import { FOOTER_LINKS } from "../copy";
import { LINKS } from "../Nav";

// Golden hour's chrome, shared by every screen in that look (home, campground): the header
// sits on forest (a photo or a plain band) in paper type; the footer closes on forest.

/** Header over the photo: paper type on the dark scrim. Same links and account states as Nav. */
export function PhotoHeader({ visitor }: { visitor: Visitor }) {
  return (
    <header className="relative z-10">
      <div className="mx-auto flex max-w-[var(--gh-max)] items-center gap-6 px-5 pt-4 sm:px-8 sm:pt-6">
        <a href="#" className="flex shrink-0 items-center gap-2.5 py-2">
          <Image src="/private/camphawk/logo-badge.png" alt="" width={34} height={34} unoptimized className="shrink-0 select-none object-contain" draggable={false} />
          <span translate="no" className="whitespace-nowrap font-ch-display text-[22px] font-extrabold tracking-[-.025em] text-ch-paper">CampHawk</span>
        </a>
        <nav aria-label="Main" className="hidden flex-1 gap-1 md:flex">
          {LINKS.map((label) => (
            <a key={label} href="#" className="whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-[15px] font-bold text-ch-line hover:bg-ch-white/10 hover:text-ch-white">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          {visitor === "subscriber" ? (
            <span className="grid size-9 place-items-center rounded-full bg-ch-paper text-ch-meta font-extrabold text-ch-forest" aria-label="Account (signed in)">TF</span>
          ) : (
            <>
              <a href="#" className="whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[15px] font-bold text-ch-paper hover:bg-ch-white/10">Sign in</a>
              {visitor === "signed-out" && <a href="#" className={buttonClasses({ size: "sm", className: "hidden min-h-11 whitespace-nowrap px-4 sm:inline-flex" })}>Sign up</a>}
            </>
          )}
        </div>
      </div>
      {/* Phone: the three tabs as a quiet row under the brand. */}
      <nav aria-label="Main" className="mx-auto flex max-w-[var(--gh-max)] gap-1 px-3 md:hidden">
        {LINKS.map((label) => (
          <a key={label} href="#" className="flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-[10px] text-[13.5px] font-bold text-ch-line hover:bg-ch-white/10">
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}

/** The forest footer, same links as CampHawk's. */
export function GhFooter() {
  return (
    <footer className="bg-ch-forest">
        <div className="mx-auto flex max-w-[var(--gh-max)] flex-wrap items-center justify-between gap-3 px-5 py-7 text-[14px] text-ch-line sm:px-8">
          <span>© 2026 CampHawk</span>
          <nav aria-label="Footer" className="flex gap-1">
            {FOOTER_LINKS.map((l) => <a key={l} href="#" className="flex min-h-11 items-center px-2 hover:text-ch-white hover:underline">{l}</a>)}
          </nav>
        </div>
    </footer>
  );
}
