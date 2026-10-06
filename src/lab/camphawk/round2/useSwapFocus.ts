"use client";

import { useEffect, useRef } from "react";

/** For a control that swaps itself for an in-place confirm (Sign out → "Sign out of CampHawk?"):
    when the confirm opens, focus moves into it; when it closes, focus goes back to the trigger.
    Without this, the trigger unmounts under the keyboard and focus falls to the page body. */
export function useSwapFocus<C extends HTMLElement = HTMLButtonElement, T extends HTMLElement = HTMLButtonElement>(open: boolean) {
  const confirmRef = useRef<C>(null);
  const triggerRef = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    (open ? confirmRef : triggerRef).current?.focus();
  }, [open]);
  return { confirmRef, triggerRef };
}
