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

/** How long after a command a poll may still be reporting the world from before it. */
export const EXPECT_GRACE_MS = 6000;

/**
 * Whether the status a command asked for ("paused") should give way to what a poll reported. It
 * does when the home server agrees, or when a poll that started well after the command finished
 * still disagrees (the command didn't take). A poll that started before or just after the
 * command can't overrule it: its answer may predate the command.
 */
export function dropExpected(o: { asked: string | null; reported: string | undefined; sending: boolean; pollStarted: number; commandDoneAt: number }): boolean {
  if (!o.asked) return false;
  if (o.reported === o.asked) return true;
  return !o.sending && o.pollStarted > o.commandDoneAt + EXPECT_GRACE_MS;
}
