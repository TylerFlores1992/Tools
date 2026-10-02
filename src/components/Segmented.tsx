"use client";

import { useRef } from "react";
import { cx } from "./cx";

/** A single-choice control with real radio semantics: one tab stop, arrows move the choice. */
export function Segmented<T extends string>({
  label, options, value, onChange,
}: {
  label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = options.findIndex((o) => o.value === value);
  function move(delta: number) {
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line-2 bg-surface p-1">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
            }}
            className={cx("flex min-h-10 items-center gap-2 rounded-full px-4 text-small transition-colors duration-150", on ? "bg-primary text-on-primary" : "text-ink-2 hover:text-ink")}
          >
            {on && <span aria-hidden="true">✓</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
