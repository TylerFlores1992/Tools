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

/** For content that replaces what was pressed (a removed watch, a confirmed hold, a decision
    recorded): when `key` changes to a non-null value, focus moves to the element `ref` is on (a
    heading or a status line with tabIndex={-1}), so the keyboard isn't left on the body. Like
    useSwapFocus, it ignores the first render, so nothing moves on page load. */
export function useFocusOnChange<E extends HTMLElement = HTMLElement>(key: unknown) {
  const ref = useRef<E>(null);
  const prev = useRef(key);
  useEffect(() => {
    if (Object.is(prev.current, key)) return;
    prev.current = key;
    if (key !== null && key !== undefined && key !== false) ref.current?.focus();
  }, [key]);
  return ref;
}
