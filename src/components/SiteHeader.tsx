import Link from "next/link";
import { SITE } from "@/lib/site";
import { cx } from "./cx";

const NAV = [
  { href: "/", label: "Home", locked: false },
  { href: "/workshop", label: "Workshop", locked: false },
  { href: "/private", label: "Private", locked: true },
] as const;

function Lock() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="hidden shrink-0 min-[360px]:block">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/** Brand mark + nav pill. `overlay` floats it over the home hero. */
export function SiteHeader({ current, overlay = false }: { current: "/" | "/workshop" | "/private" | null; overlay?: boolean }) {
  return (
    <header className={cx("z-20 flex items-center justify-between px-5 py-5 sm:px-12 sm:py-7 3xl:px-16 3xl:py-9", overlay ? "absolute inset-x-0 top-0" : "relative")}>
      <Link href="/" className="group flex min-h-11 items-center gap-3 whitespace-nowrap rounded-btn pr-2 text-body font-semibold tracking-[-0.01em] text-ink 3xl:text-lede">
        <span aria-hidden="true" className="size-2 rotate-45 rounded-[2px] bg-ember shadow-[0_0_12px_var(--fw-ember)] transition-transform duration-300 ease-out group-hover:rotate-[135deg]" />
        {SITE.name}
      </Link>
      <nav aria-label="Main" className="rounded-full border border-line bg-surface/50 p-1 backdrop-blur-md">
        <ul className="flex items-center gap-1">
          {NAV.map((item) => (
            // On phones the brand is the way home, so Home steps aside to keep one tidy line.
            <li key={item.href} className={item.href === "/" ? "hidden sm:block" : undefined}>
              <Link
                href={item.href}
                // Private is behind a sign-in; prefetching it would only cache the redirect.
                prefetch={item.locked ? false : undefined}
                aria-current={current === item.href ? "page" : undefined}
                className="flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-small min-[360px]:px-3 text-ink-2 sm:min-h-9 sm:px-4 3xl:min-h-12 3xl:px-6 3xl:text-body transition-colors duration-150 hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink"
              >
                {item.locked && <Lock />}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
