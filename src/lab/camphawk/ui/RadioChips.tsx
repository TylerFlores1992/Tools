"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/components/cx";
import { Chip } from "./Chip";

// Ported from campsite-finder src/components/ui/RadioChips.tsx (2026-10-06): a row of chips where
// exactly one is chosen, as a WAI-ARIA radio group. One tab stop; arrows move AND choose (wrapping),
// Home/End jump. `contents` lets the chips join the caller's own flex row.
export interface RadioChipOption<T> {
  value: T;
  label: ReactNode;
}

export function RadioChips<T>({
  options, value, onChange, label, size = "sm", layout = "row", className,
}: {
  options: ReadonlyArray<RadioChipOption<T>>;
  value: T | undefined;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  layout?: "row" | "contents";
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const chosen = options.findIndex((o) => Object.is(o.value, value));
  const tabStop = chosen >= 0 ? chosen : 0;

  function move(to: number) {
    const n = options.length;
    const i = ((to % n) + n) % n;
    onChange(options[i].value);
    refs.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const at = refs.current.findIndex((el) => el === document.activeElement);
    if (at < 0) return;
    const keys: Record<string, number> = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: options.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    move(keys[e.key]);
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cx(layout === "contents" ? "contents" : "flex flex-wrap gap-1.5", className)}>
      {options.map((o, i) => (
        <Chip
          key={String(o.value)}
          ref={(el) => { refs.current[i] = el; }}
          role="radio"
          size={size}
          selected={i === chosen}
          tabIndex={i === tabStop ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
