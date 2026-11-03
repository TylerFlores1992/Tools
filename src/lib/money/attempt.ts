import "server-only";

/** The one sentence a page shows when the money database didn't answer. No internals. */
export const DB_DOWN = "Couldn’t reach the money database. Try again in a minute.";

/**
 * Runs database work for a Server Action and reports whether it worked, instead of throwing into
 * the error page. Logs the error's name only (docs/MONEY.md: never log data or URLs). Keep
 * `redirect()` OUTSIDE the callback: it works by throwing, and this would swallow it.
 */
export async function attempt(what: string, work: () => Promise<unknown>): Promise<boolean> {
  try {
    await work();
    return true;
  } catch (e) {
    console.error(`money ${what} failed`, e instanceof Error ? e.name : "unknown");
    return false;
  }
}
