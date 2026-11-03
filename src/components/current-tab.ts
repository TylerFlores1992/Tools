export type AppTab = { href: string; label: string };

/** The tab whose href is the longest match for the path: /money/income/stubs/7 lights "Income". */
export function currentTab(tabs: readonly AppTab[], path: string): string | null {
  let best: string | null = null;
  for (const t of tabs) {
    if ((path === t.href || path.startsWith(`${t.href}/`)) && (!best || t.href.length > best.length)) best = t.href;
  }
  return best;
}
