"use client";

import { useEffect, useRef } from "react";

/** For a control that swaps itself for an in-place confirm (Sign out → "Sign out of CampHawk?"):
    when the confirm opens, focus moves into it (put `confirmRef` on the SAFE choice, so two
    presses of Enter never do the destructive thing); when it closes, focus goes back to the
    trigger. Without this, the trigger unmounts under the keyboard and focus falls to the body.
    It acts only when `open` actually changes, so React's double-run of effects in development
    doesn't move focus on page load. */
export function useSwapFocus<C extends HTMLElement = HTMLButtonElement, T extends HTMLElement = HTMLButtonElement>(open: boolean) {
  const confirmRef = useRef<C>(null);
  const triggerRef = useRef<T>(null);
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    (open ? confirmRef : triggerRef).current?.focus();
  }, [open]);
  return { confirmRef, triggerRef };
}
