"use client";

import { useId, useState } from "react";
import { cx } from "@/components/cx";
import { parseLength, type Units } from "../units";

/** A length typed the way a rigger writes it (12'-6", 450mm, 3.5 ft). Errors in words. */
export function LengthField({
  label, units, value, onChange, placeholder,
}: {
  label: string; units: Units; value: string; onChange: (text: string, parsed: number | null) => void; placeholder?: string;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const parsed = parseLength(value, units);
  const bad = touched && value.trim() !== "" && parsed === null;
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-small text-ink-2">{label}</label>
      <div className={cx("field flex min-h-11 items-center rounded-input border bg-surface transition-colors duration-150", bad ? "border-wrong" : "border-control")}>
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.value, parseLength(e.target.value, units))}
          onBlur={() => setTouched(true)}
          size={1}
          className="w-full min-w-0 bg-transparent px-3 py-2 text-body tabular-nums text-ink outline-none placeholder:text-muted"
        />
      </div>
      {bad && (
        <p id={`${id}-err`} role="alert" className="flex items-center gap-1.5 text-small text-wrong">
          <span aria-hidden="true">✕</span> Write it like 6&apos;-3&quot;, 4&quot;, 450mm or 1.2 m.
        </p>
      )}
    </div>
  );
}
