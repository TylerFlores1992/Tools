// The study tool's pages, in one place: the tab strip and the breadcrumb both read from here,
// so a new practice set shows up in both without typing its name twice.

import { PRACTICE_SETS } from "./questions.ts";

export const STUDY_BASE = "/workshop/etcp-rigger-study";

export type StudyPage = { href: string; tab: string; name: string };

export const STUDY_PAGES: readonly StudyPage[] = [
  { href: STUDY_BASE, tab: "Overview", name: "Overview" },
  ...PRACTICE_SETS.map((s) => ({ href: `${STUDY_BASE}/practice/${s.slug}`, tab: `Test ${s.slug.toUpperCase()}`, name: s.name })),
  { href: `${STUDY_BASE}/flashcards`, tab: "Flashcards", name: "Flashcards" },
  { href: `${STUDY_BASE}/formulas`, tab: "Formulas", name: "Formula reference" },
];

/** The study page a path is on (ignores a trailing slash, query and hash), or undefined. */
export function studyPageFor(path: string): StudyPage | undefined {
  const clean = path.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  return STUDY_PAGES.find((p) => p.href === clean);
}
