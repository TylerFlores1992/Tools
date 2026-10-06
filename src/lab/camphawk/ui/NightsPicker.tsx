"use client";

import { useId, useState } from "react";
import { cx } from "@/components/cx";
import { Chip } from "./Chip";

// Ported from campsite-finder src/components/ui/NightsPicker.tsx (2026-10-06): "N nights in a
// row", optionally weekends only. 1-5 are chips; "Other" reveals a field that edits a local draft
// and commits on blur or Enter, so typing "14" never unmounts the field at the "1".
const QUICK = [1, 2, 3, 4, 5];

export function NightsPicker({
  nights, onNightsChange, weekendsOnly, onWeekendsOnlyChange, showWeekendsOnly = true, min = 1, max = 30,
}: {
  nights: number;
  onNightsChange: (n: number) => void;
  weekendsOnly: boolean;
  onWeekendsOnlyChange: (v: boolean) => void;
  showWeekendsOnly?: boolean;
  min?: number;
  max?: number;
}) {
  const id = useId();
  const [customMode, setCustomMode] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const custom = customMode || !QUICK.includes(nights);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const commit = (): number => {
    const v = parseInt(draft ?? "", 10);
    const next = draft !== null && Number.isFinite(v) ? clamp(v) : nights;
    if (next !== nights) onNightsChange(next);
    setDraft(null);
    return next;
  };

  return (
    <div>
      <div role="group" aria-label="Stay length" className="flex flex-wrap gap-1.5">
        {QUICK.map((n) => (
          <Chip key={n} size="sm" selected={!custom && nights === n} onClick={() => { setCustomMode(false); setDraft(null); onNightsChange(n); }}>
            {n} {n === 1 ? "night" : "nights"}
          </Chip>
        ))}
        <Chip size="sm" selected={custom} onClick={() => { setCustomMode(true); if (!custom) onNightsChange(7); }}>
          Other
        </Chip>
      </div>
      {custom && (
        <div className="mt-2.5 flex items-center gap-2.5">
          <label htmlFor={`${id}-n`} className="sr-only">Number of nights</label>
          <input
            id={`${id}-n`}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={draft ?? String(nights)}
            onFocus={() => setCustomMode(true)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { if (QUICK.includes(commit())) setCustomMode(false); }}
            onKeyDown={(e) => { if (e.key === "Enter" && draft !== null) { e.preventDefault(); commit(); } }}
            className={cx("min-h-11 w-[84px] rounded-[10px] border border-ch-green bg-ch-card px-2.5 py-2 font-ch-display text-[16px] font-bold text-ch-ink", "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green")}
          />
          <span className="text-[14px] font-semibold text-ch-muted">nights in a row</span>
        </div>
      )}
      {showWeekendsOnly && (
        <div className="mt-2.5">
          <Chip size="sm" selected={weekendsOnly} onClick={() => onWeekendsOnlyChange(!weekendsOnly)}>Weekends only</Chip>
          {weekendsOnly && <p className="mt-1.5 px-0.5 text-[13px] leading-normal text-ch-muted">Only runs that include a Saturday night count as a match.</p>}
        </div>
      )}
    </div>
  );
}
