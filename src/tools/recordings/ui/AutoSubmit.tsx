"use client";

import { useEffect, useRef } from "react";

/**
 * Submits the surrounding GET form as you type (after a pause) or pick from a select, so search
 * feels live. Without JavaScript the form's own button still works.
 */
export function AutoSubmit({ delay = 350 }: { delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const submit = () => form.requestSubmit();
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.type !== "search" && t.type !== "text") return;
      clearTimeout(timer);
      if (t.value.trim().length >= 2 || t.value === "") timer = setTimeout(submit, delay);
    };
    const onChange = (e: Event) => { if ((e.target as HTMLElement).tagName === "SELECT") submit(); };
    form.addEventListener("input", onInput);
    form.addEventListener("change", onChange);
    return () => { clearTimeout(timer); form.removeEventListener("input", onInput); form.removeEventListener("change", onChange); };
  }, [delay]);
  return <span ref={ref} hidden />;
}
