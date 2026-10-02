"use client";

import { useId, useState } from "react";
import { cx } from "./cx";

/**
 * A decimal input that keeps the visitor's draft while they type ("1" on the way to "14" is
 * never clobbered), reports a parsed number upward only when it's valid, and says what's
 * wrong in words (✕ + text) when it isn't.
 */
export function NumberField({
  label, value, unit, onChange, min, max, step = 0.1, hint, decimals = 1, id: idProp,
}: {
  label: string; value: number; unit: string; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; hint?: string; decimals?: number; id?: string;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const fmt = (n: number) => (Number.isFinite(n) ? String(Number(n.toFixed(decimals))) : "");
  const [draft, setDraft] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");

  // While typing, show the draft; otherwise follow the value (dragging, presets, unit switch).
  const shown = focused ? draft : fmt(value);

  function commit(text: string) {
    setDraft(text);
    const n = Number(text.replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(n)) return setError("Enter a number.");
    if (min !== undefined && n < min) return setError(`Use ${min} or more.`);
    if (max !== undefined && n > max) return setError(`Use ${max} or less.`);
    setError("");
    onChange(n);
  }

  function nudge(dir: 1 | -1, big: boolean) {
    const n = Number.isFinite(value) ? value : 0;
    let next = Number((n + dir * (big ? step * 10 : step)).toFixed(6));
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setError("");
    onChange(next);
    setDraft(fmt(next));
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-small text-ink-2">{label}</label>
      <div className={cx("flex min-h-12 items-center rounded-input border bg-surface pr-4 transition-colors duration-150 focus-within:border-ember", error ? "border-wrong" : "border-control")}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={shown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(e) => commit(e.target.value)}
          onFocus={() => { setDraft(fmt(value)); setFocused(true); }}
          onBlur={() => { setFocused(false); setError(""); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); nudge(e.key === "ArrowUp" ? 1 : -1, e.shiftKey); }
          }}
          size={1} className="w-full min-w-0 flex-1 bg-transparent px-4 py-3 text-body font-medium tabular-nums text-ink outline-none"
        />
        <span aria-hidden="true" className="font-mono text-label uppercase text-muted">{unit}</span>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="flex items-center gap-1.5 text-small text-wrong">
          <span aria-hidden="true">✕</span> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-small text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
