"use client";

import { useActionState, useEffect, useState } from "react";
import { State } from "@/components/State";
import { SubmitButton } from "@/components/SubmitButton";
import { recategorize, type FormState } from "@/app/private/money/actions";

const SELECT = "field min-h-11 w-full rounded-input border border-control bg-surface px-3 text-body text-ink";
const MOVED = "money:moved";

/**
 * A transaction's category, with "Saving…" while it saves and "Filed as …" after. Keyed on the
 * saved category so the select shows the new value (React resets a form after its action; a reset
 * select would snap back to the old category). When the list is filtered by category and the row
 * no longer matches, the row disappears with its message, so the page-level <MovedNote> says it.
 */
export function CategoryForm({ id, description, label, category, source, merchant, categories, filter }: {
  id: string;
  description: string;
  /** The name the row shows, for the moved note. */
  label: string;
  category: string | null;
  source: string | null;
  merchant: string;
  categories: readonly string[];
  /** The category the list is filtered to, if any. */
  filter: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await recategorize(prev, form);
    if (r.done && filter && r.done !== filter) {
      window.dispatchEvent(new CustomEvent(MOVED, { detail: `Filed “${label}” as ${r.done}. It no longer shows under ${filter}.` }));
    }
    return r;
  }, { attempt: 0 });
  return (
    <>
      <form key={`${category ?? ""}|${source ?? ""}`} action={action} className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr_auto] sm:items-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="description" value={description} />
        <label className="grid gap-1">
          <span className="sr-only">Category</span>
          <select name="category" defaultValue={category ?? ""} className={SELECT}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {merchant.length >= 3 ? (
          <label className="flex min-h-11 items-center gap-3 text-small text-ink-2">
            <input type="checkbox" name="always" defaultChecked className="size-5 accent-ink" />
            <span>Always file “{merchant}” this way</span>
          </label>
        ) : <span />}
        <SubmitButton variant="quiet" pending="Saving…">Save</SubmitButton>
      </form>
      <p aria-live="polite" className="mt-2 text-small">
        {state.error ? <State kind="wrong">{state.error}</State> : state.done ? <State kind="ok">Saved: filed as {state.done}.</State> : null}
      </p>
    </>
  );
}

/** The note for a row that left a filtered list after its category changed. */
export function MovedNote() {
  const [text, setText] = useState("");
  useEffect(() => {
    const on = (e: Event) => setText((e as CustomEvent<string>).detail);
    window.addEventListener(MOVED, on);
    return () => window.removeEventListener(MOVED, on);
  }, []);
  return (
    <p aria-live="polite" className="text-small">
      {text ? <State kind="ok">{text}</State> : null}
    </p>
  );
}
