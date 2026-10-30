"use client";

import { usePracticeAnswers } from "./stored";
import { PRACTICE_SETS } from "./questions";

/** "12 of 25 answered" on an overview card, from this browser's saved answers. Nothing until there's progress. */
export function SavedProgress({ slug }: { slug: string }) {
  const [answers] = usePracticeAnswers(slug);
  const qs = PRACTICE_SETS.find((s) => s.slug === slug)?.questions ?? [];
  const done = qs.filter((q) => answers[q.id] !== undefined).length;
  if (!done) return null;
  const all = done === qs.length;
  return (
    <span className="mt-3 flex items-center gap-2 text-small tabular-nums text-ink-2">
      {all && <span aria-hidden="true" className="text-ice">✓</span>}
      {all ? `All ${qs.length} answered` : `${done} of ${qs.length} answered`}
      <span className="sr-only">, saved in this browser</span>
    </span>
  );
}
