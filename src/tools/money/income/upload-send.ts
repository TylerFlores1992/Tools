/**
 * Sending one stub photo from the phone. A send can fail before the site answers: the connection
 * drops for a moment, the phone sleeps or switches apps mid-batch, or the site turns the request
 * away. All of those used to show the same "didn't go through", with the reason thrown away.
 *
 * Sending again is safe: the server skips a file it already has and re-reads one whose read
 * failed or never finished (`retryOnUpload`), so a retry never makes a second stub.
 */

/** Waits between tries: one quick retry, then one after a longer pause. */
export const RETRY_DELAYS_MS = [2000, 5000] as const;

/** The largest file the site takes (`uploadOne`'s MAX_BYTES). */
export const MAX_UPLOAD_BYTES = 4_000_000;

/** Runs `send`, trying again after each delay when it throws. A returned answer is never retried. */
export async function sendWithRetry<T>(
  send: () => Promise<T>,
  delays: readonly number[] = RETRY_DELAYS_MS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1]);
    try {
      return await send();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

const NETWORK = /failed to fetch|load failed|networkerror|network request failed|network connection was lost/i;
const TURNED_AWAY = /unexpected response|413|payload too large|body exceeded/i;

/** Plain words for a send that failed every try, with the browser's own words kept for diagnosis. */
export function sendFailureMessage(e: unknown, online: boolean): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const detail = raw ? ` (${raw.slice(0, 80)})` : "";
  if (!online) return "Your phone is offline. Reconnect, then tap Try again.";
  if (NETWORK.test(raw)) return `The connection dropped. Keep this page open with the screen on, then tap Try again.${detail}`;
  if (TURNED_AWAY.test(raw)) return `The site turned this upload away. If it keeps happening, sign in again or send a smaller photo.${detail}`;
  return `The upload didn’t go through. Tap Try again.${detail}`;
}

/** Said before sending, when even the shrunk photo is too big for the site to take. */
export function tooBigMessage(bytes: number): string | null {
  return bytes > MAX_UPLOAD_BYTES ? `Too big to send (${(bytes / 1_000_000).toFixed(1)} MB, the limit is 4 MB). Take the photo again, a little further back.` : null;
}
