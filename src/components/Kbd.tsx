import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-tag border border-line-2 bg-surface-2 px-1.5 py-0.5 font-mono text-label text-ink">{children}</kbd>;
}
