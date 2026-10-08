import { CircleCheck, TriangleAlert, CircleX, type LucideIcon } from "lucide-react";
import { cx } from "@/components/cx";

// Ported from campsite-finder src/components/admin/status-mark.tsx (2026-10-07): CampHawk's admin
// says a level with a SHAPE and a WORD before any colour, because the owner is colour-blind. The
// shapes differ in silhouette at 12px: a round tick, a triangle, a round cross. Same lucide
// glyphs as the lab's Tag marks (CircleCheck, TriangleAlert, CircleX).

export type Level = "ok" | "warn" | "fail";

export const LEVEL_MARK: Record<Level, { Icon: LucideIcon; word: string; box: string; text: string }> = {
  ok: { Icon: CircleCheck, word: "OK", box: "border-ch-green-line bg-ch-green-soft", text: "text-ch-green-deep" },
  warn: { Icon: TriangleAlert, word: "Warning", box: "border-ch-ochre-line bg-ch-ochre-soft", text: "text-ch-ochre-ink" },
  fail: { Icon: CircleX, word: "Failing", box: "border-ch-alert-line bg-ch-alert-soft", text: "text-ch-alert-deep" },
};

/** `label` replaces the WORD, never the shape; `showWord` hides only the visible word. */
export function StatusMark({ level, label, showWord = true, className }: { level: Level; label?: string; showWord?: boolean; className?: string }) {
  const { Icon, text } = LEVEL_MARK[level];
  const word = label ?? LEVEL_MARK[level].word;
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap font-bold", text, className)}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {showWord ? word : <span className="sr-only">{word}</span>}
    </span>
  );
}
