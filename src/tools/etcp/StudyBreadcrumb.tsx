"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDY_BASE, studyPageFor } from "./nav";

/**
 * Workshop / tool / current page. The last crumb is the page you're on (aria-current, not a
 * link); on the overview the tool itself is the current page.
 */
export function StudyBreadcrumb({ toolName }: { toolName: string }) {
  const page = studyPageFor(usePathname() ?? STUDY_BASE);
  const onHub = !page || page.href === STUDY_BASE;
  return (
    <nav aria-label="Breadcrumb" className="text-small text-muted">
      <ol className="flex flex-wrap items-center gap-y-1">
        <li>
          <Link href="/workshop" className="hover:text-ink">Workshop</Link>
        </li>
        <li className="flex items-center">
          <span aria-hidden="true" className="mx-2">/</span>
          {onHub ? (
            <span aria-current="page" className="text-ink-2">{toolName}</span>
          ) : (
            <Link href={STUDY_BASE} className="hover:text-ink">{toolName}</Link>
          )}
        </li>
        {!onHub && (
          <li className="flex items-center">
            <span aria-hidden="true" className="mx-2">/</span>
            <span aria-current="page" className="text-ink-2">{page.name}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}
