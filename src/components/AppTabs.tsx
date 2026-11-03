"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./cx";
import { currentTab, type AppTab } from "./current-tab";

/**
 * The pill tabs under a private app's breadcrumb. The tab follows the URL, so it lights up the
 * moment you tap it (with a loading.tsx the URL changes at once, before the page has loaded), and
 * a small dot pulses on the tapped tab while Next is still fetching. `current` overrides the URL,
 * for a page that belongs to a tab it isn't under.
 */
export function AppTabs({ label, tabs, current }: { label: string; tabs: readonly AppTab[]; current?: string | null }) {
  const path = usePathname();
  const active = current !== undefined ? current : currentTab(tabs, path);
  return (
    <nav aria-label={label} className="mt-4 overflow-x-auto">
      <ul className="inline-flex gap-1 rounded-full border border-line bg-surface p-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active === t.href ? "page" : undefined}
              className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-small whitespace-nowrap text-ink-2 transition-colors duration-150 hover:text-ink aria-[current=page]:bg-primary aria-[current=page]:text-on-primary"
            >
              {t.label}
              <TabPending />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Fixed size, always rendered, so showing it never moves the tab's text. */
function TabPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cx("size-1.5 shrink-0 rounded-full bg-current transition-opacity duration-150", pending ? "animate-pulse opacity-100 motion-reduce:animate-none" : "opacity-0")}
    />
  );
}
