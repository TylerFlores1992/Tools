"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRACTICE_SETS } from "./questions";

const BASE = "/workshop/etcp-rigger-study";
const ITEMS = [
  { href: BASE, label: "Overview" },
  ...PRACTICE_SETS.map((s) => ({ href: `${BASE}/practice/${s.slug}`, label: `Test ${s.slug.toUpperCase()}` })),
  { href: `${BASE}/flashcards`, label: "Flashcards" },
  { href: `${BASE}/formulas`, label: "Formulas" },
];

/** Sections of the study tool. The current one is marked by fill and aria-current, not hue. */
export function StudyNav() {
  const path = usePathname();
  return (
    <nav aria-label="Study sections" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-full border border-line bg-surface p-1">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={path === item.href ? "page" : undefined}
              className="flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-small text-ink-2 transition-colors duration-150 hover:text-ink aria-[current=page]:bg-primary aria-[current=page]:text-on-primary"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
