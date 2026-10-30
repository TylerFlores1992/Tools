"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDY_PAGES, studyPageFor } from "./nav";

/**
 * Sections of the study tool. The current one is marked by fill and aria-current, not hue.
 * Below sm the tabs wrap into a three-column grid so none hide off the edge of a phone.
 */
export function StudyNav() {
  const current = studyPageFor(usePathname() ?? "")?.href;
  return (
    <nav aria-label="Study sections" className="sm:overflow-x-auto">
      <ul className="grid grid-cols-3 gap-1 rounded-card border border-line bg-surface p-1 sm:flex sm:w-max sm:rounded-full">
        {STUDY_PAGES.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current === item.href ? "page" : undefined}
              className="flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-2 text-small text-ink-2 transition-colors duration-150 hover:text-ink aria-[current=page]:bg-primary aria-[current=page]:text-on-primary sm:px-4"
            >
              {item.tab}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
