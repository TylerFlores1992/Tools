/** How often the Page Turner asks the home server how things are. */
export const POLL_MS = 3000;

/**
 * The wait before the next look, after `failures` failed looks in a row: every 3 s while it
 * answers, then 15 s, then 30 s at most, so a slow or sleeping home server isn't asked again and
 * again while each ask can take up to 12 s.
 */
export function nextPollDelay(failures: number): number {
  if (failures <= 0) return POLL_MS;
  return Math.min(30_000, 15_000 * failures);
}
