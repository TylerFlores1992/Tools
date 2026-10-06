"use client";

import { useId } from "react";
import { Chip } from "./Chip";
import { Collapsible } from "./Collapsible";
import { RadioChips } from "./RadioChips";

// Ported from campsite-finder src/components/ui/FilterPanel.tsx (2026-10-06), with its taxonomy:
// site type is single-select (no RV chip: Hookups and Pad length answer that better), Hookups is
// a toggle beside it after a divider, pad length is its own always-visible control. Showers, pets
// and drinking water were removed from CampHawk on measurement, so they aren't here either.
export interface FilterValue {
  siteType: string | null;
  rvLength: number | null;
  electric: boolean;
}

export const EMPTY_FILTERS: FilterValue = { siteType: null, rvLength: null, electric: false };

const SITE_TYPES: Array<{ value: string | null; label: string }> = [
  { value: null, label: "All types" },
  { value: "tent", label: "Tent" },
  { value: "cabin", label: "Cabin" },
  { value: "group", label: "Group" },
];
const PAD_LENGTHS = [24, 28, 32, 36, 40];

export const countApplied = (v: FilterValue) => (v.siteType ? 1 : 0) + (v.rvLength ? 1 : 0) + (v.electric ? 1 : 0);

const legend = "mb-2 text-[13px] font-extrabold text-ch-ink-2";

export function FilterPanel({ value, onChange }: { value: FilterValue; onChange: (v: FilterValue) => void }) {
  const id = useId();
  const applied = countApplied(value);
  return (
    <Collapsible label="Filters" summary={applied ? `${applied} applied` : "all sites"}>
      <fieldset>
        <legend className={legend}>Site type</legend>
        <div className="flex flex-wrap items-center gap-1.5">
          <RadioChips label="Site type" layout="contents" options={SITE_TYPES} value={value.siteType} onChange={(siteType) => onChange({ ...value, siteType })} />
          <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-ch-line" />
          <Chip size="sm" selected={value.electric} onClick={() => onChange({ ...value, electric: !value.electric })}>Hookups</Chip>
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className={legend}>Pad length</legend>
        <RadioChips
          label="Pad length"
          options={[{ value: null, label: "Any" }, ...PAD_LENGTHS.map((ft) => ({ value: ft as number | null, label: `${ft} ft` }))]}
          value={value.rvLength}
          onChange={(rvLength) => onChange({ ...value, rvLength })}
        />
        <p id={`${id}-hint`} className="mt-2 px-0.5 text-[13px] leading-normal text-ch-muted">
          Only campgrounds with a site that lists a pad this long. Sites with no length on file are left out.
        </p>
      </fieldset>
    </Collapsible>
  );
}
