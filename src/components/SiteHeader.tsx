import Link from "next/link";
import { SITE } from "@/lib/site";
import { cx } from "./cx";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/workshop", label: "Workshop" },
] as const;

/** Brand mark + nav pill. `overlay` floats it over the home hero. */
export function SiteHeader({ current, overlay = false }: { current: "/" | "/workshop" | null; overlay?: boolean }) {
  return (
    <header className={cx("z-20 flex items-center justify-between px-5 py-5 sm:px-12 sm:py-7 3xl:px-16 3xl:py-9", overlay ? "absolute inset-x-0 top-0" : "relative")}>
      <Link href="/" className="group flex min-h-11 items-center gap-3 rounded-btn pr-2 text-body font-semibold tracking-[-0.01em] text-ink">
        <span aria-hidden="true" className="size-2 rotate-45 rounded-[2px] bg-ember shadow-[0_0_12px_var(--fw-ember)] transition-transform duration-300 ease-out group-hover:rotate-[135deg]" />
        {SITE.name}
      </Link>
      <nav aria-label="Main" className="rounded-full border border-line bg-surface/50 p-1 backdrop-blur-md">
        <ul className="flex items-center gap-1">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current === item.href ? "page" : undefined}
                className="flex min-h-9 items-center rounded-full px-4 text-small text-ink-2 transition-colors duration-150 hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
