"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
const thisYear = () => new Date().getFullYear();

/**
 * The current year, for the footer. Pages are built once and served for months, so a year
 * computed at build goes stale on New Year's Day. The HTML carries the build year (`built`),
 * hydration reuses it (no mismatch), and the browser then swaps in its own year if it differs.
 */
export function Year({ built }: { built: number }) {
  return <>{useSyncExternalStore(noSubscribe, thisYear, () => built)}</>;
}
