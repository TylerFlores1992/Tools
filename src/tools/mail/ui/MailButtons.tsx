"use client";

import { useEffect, useOptimistic } from "react";
import { cx } from "@/components/cx";

/**
 * The ✓ beside an item: it flips the moment you press it (the server catches up behind it), so a
 * slow save never leaves you wondering whether the tap landed. A second press while one is saving
 * is ignored.
 */
export function DoneToggle({ id, title, done, action }: { id: string; title: string; done: boolean; action: (form: FormData) => Promise<void> }) {
  const [shown, setShown] = useOptimistic(done);
  const saving = shown !== done;
  return (
    <form
      action={async (fd) => {
        setShown(fd.get("on") === "1");
        await action(fd);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="on" value={done ? "0" : "1"} />
      <button
        type="submit"
        aria-label={`${shown ? "Restore" : "Mark handled"}: ${title}`}
        aria-pressed={shown}
        aria-busy={saving || undefined}
        onClick={(e) => {
          if (saving) e.preventDefault();
        }}
        className={cx(
          "flex size-11 shrink-0 items-center justify-center rounded-full border border-control text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink aria-pressed:bg-primary aria-pressed:text-on-primary",
          saving && "cursor-progress",
        )}
      >
        <span aria-hidden="true">✓</span>
      </button>
    </form>
  );
}

/**
 * Once a one-off note ("Mail from … goes to Trash from now on") has been shown, takes its words
 * out of the address, so a reload or the next refresh doesn't show it again.
 */
export function ClearNoteParams({ keys }: { keys: readonly string[] }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const k of keys) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(null, "", url); // null: Next keeps its router in step
  }, [keys]);
  return null;
}
