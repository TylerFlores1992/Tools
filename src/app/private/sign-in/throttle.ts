import { createHash } from "node:crypto";

/**
 * Slows down password guessing on the Private sign-in, with no database and no new service.
 *
 * Each server instance remembers, in memory, how many wrong passwords came from each address
 * (stored as a salted hash, never the address itself). After MAX_FAILURES wrong tries inside
 * WINDOW_MS, that address is locked out for LOCK_MS, and the password isn't even checked.
 *
 * What it does NOT do: Vercel runs several instances and recycles them, so the count is per
 * instance and resets on a cold start. A patient attacker spread across instances (or addresses)
 * still gets through slowly. Combined with the fixed delay on every wrong try, it turns "thousands
 * a minute" into "a handful a minute per instance". The real protection is a long password.
 */

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;
export const LOCK_MS = 15 * 60_000;
/** Most addresses remembered at once; the oldest are dropped first. */
export const MAX_TRACKED = 2_000;

type Entry = { failures: number[]; lockedUntil: number };

export class Throttle {
  private readonly seen = new Map<string, Entry>();

  /** Milliseconds until this address may try again (0 = it may try now). */
  lockedFor(key: string, now = Date.now()): number {
    const e = this.seen.get(key);
    if (!e) return 0;
    return Math.max(0, e.lockedUntil - now);
  }

  /** A wrong password. Returns true when this one locks the address out. */
  fail(key: string, now = Date.now()): boolean {
    const e = this.seen.get(key) ?? { failures: [], lockedUntil: 0 };
    e.failures = e.failures.filter((t) => now - t < WINDOW_MS);
    e.failures.push(now);
    let locked = false;
    if (e.failures.length >= MAX_FAILURES) {
      e.lockedUntil = now + LOCK_MS;
      e.failures = [];
      locked = true;
    }
    // Re-insert so the Map's order is "least recently failed first".
    this.seen.delete(key);
    this.seen.set(key, e);
    while (this.seen.size > MAX_TRACKED) {
      const oldest = this.seen.keys().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
    return locked;
  }

  /** The right password: forget this address's wrong tries. */
  succeed(key: string): void {
    this.seen.delete(key);
  }

  get size(): number {
    return this.seen.size;
  }
}

/** The first address in x-forwarded-for (Vercel sets it), else x-real-ip, hashed with a per-instance salt. */
export function clientKey(forwardedFor: string | null, realIp: string | null, salt: string): string {
  const ip = (forwardedFor?.split(",")[0] ?? "").trim() || (realIp ?? "").trim() || "unknown";
  return createHash("sha256").update(`${salt}\u0000${ip}`).digest("base64url").slice(0, 22);
}
