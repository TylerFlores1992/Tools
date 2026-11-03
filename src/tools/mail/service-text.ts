/**
 * Small pieces of Morning Mail that turn what other services do into plain behavior and plain
 * sentences: one unsubscribe press per sender, and Yahoo / Gmail failures worded for a person
 * (the raw text goes to the server log, never onto the page).
 */

export type Pressed = { ok: boolean; note: string };

/** How many different unsubscribe links one sender gets pressed before we stop trying (each can take 10 s). */
export const MAX_UNSUB_TRIES = 3;

/**
 * Wraps the one-click unsubscribe press so a batch presses each link once and stops at a sender's
 * first success: senders put a different token in every email's link, and pressing all of them
 * made "Unsubscribe" press the same list over and over (and run past the 60 s limit).
 */
export function unsubscribeOnce(press: (url: string | null) => Promise<Pressed>, maxTries = MAX_UNSUB_TRIES) {
  const bySender = new Map<string, { done: Pressed | null; tries: number }>();
  const byUrl = new Map<string, Pressed>();
  return async (sender: string | null, url: string | null): Promise<Pressed> => {
    const key = (sender ?? "").toLowerCase() || `link:${url ?? ""}`;
    const s = bySender.get(key) ?? { done: null, tries: 0 };
    bySender.set(key, s);
    if (s.done) return s.done;
    if (url && byUrl.has(url)) return byUrl.get(url)!;
    if (s.tries >= maxTries) return { ok: false, note: "Not tried again: this sender's other unsubscribe links didn't work." };
    s.tries++;
    const r = await press(url);
    if (url) byUrl.set(url, r);
    if (r.ok) s.done = r;
    return r;
  };
}

/** A Yahoo IMAP failure as one sentence (log the raw error yourself; it never goes on the page). */
export function imapProblem(e: unknown): string {
  const err = (e ?? {}) as { authenticationFailed?: boolean; responseText?: string; serverResponseCode?: string; code?: string; message?: string };
  const said = `${err.serverResponseCode ?? ""} ${err.responseText ?? ""} ${err.message ?? ""}`.toLowerCase();
  if (err.authenticationFailed || /authenticationfailed|invalid credentials|login failed/.test(said)) {
    return "Yahoo did not accept that sign-in. Use an app password (Yahoo Account Security → Generate app password), not your normal password.";
  }
  if (["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN"].includes(err.code ?? "") || /timed? ?out|socket|connection/.test(said)) {
    return "Couldn't reach Yahoo's mail server. It will try again at the next run.";
  }
  if (/unavailable|try again|too many|limit|throttl|busy/.test(said)) return "Yahoo's mail server was busy.";
  if (/nonexistent|no such|not found|trycreate/.test(said)) return "Yahoo couldn't find that folder or email.";
  return "Yahoo couldn't do that just now.";
}

/** What the Gmail script reported for a move it couldn't make, as one sentence. */
export function gmailProblem(raw: unknown): string {
  const said = String(raw ?? "").toLowerCase();
  if (/not found|no item|invalid (argument|id)|does not exist|deleted/.test(said)) return "It was no longer in Gmail.";
  if (/too many times|quota|rate limit|limit exceeded|try again/.test(said)) return "Gmail was busy and didn't move it.";
  if (/permission|authori[sz]|access/.test(said)) return "The Gmail script isn't allowed to move mail. Run setup in Apps Script again.";
  return "Gmail couldn't move this email.";
}
