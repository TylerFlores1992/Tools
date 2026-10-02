import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The private area's sign-in, shared by src/proxy.ts (checks the cookie) and the sign-in Server
 * Action (sets it). One password, no username: LAB_PASSWORD, set by the owner in Vercel.
 *
 * The session cookie is `v1.<expiry>.<signature>`: an HMAC of the expiry, keyed from the
 * password itself. Nothing is stored server-side, and changing the password signs everyone out.
 */

export const SESSION_COOKIE = "fw_private";
export const SESSION_DAYS = 30;
export const SESSION_PATH = "/private";
export const SIGN_IN_PATH = "/private/sign-in";

const VERSION = "v1";
const sha256 = (s: string) => createHash("sha256").update(s).digest();
const keyFor = (password: string) => sha256(`fw-private\u0000${password}`);
const sign = (password: string, payload: string) => createHmac("sha256", keyFor(password)).update(payload).digest("base64url");

/** Compares in constant time (hashing first makes the lengths equal). */
export function passwordMatches(given: string, password: string): boolean {
  return timingSafeEqual(sha256(given), sha256(password));
}

/** A session token valid for SESSION_DAYS from `now` (ms). */
export function createSession(password: string, now = Date.now()): string {
  const payload = `${VERSION}.${now + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${sign(password, payload)}`;
}

/** True only for an unexpired token signed with this password. */
export function verifySession(token: string | undefined, password: string | undefined, now = Date.now()): boolean {
  if (!token || !password) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION || !/^\d{1,16}$/.test(parts[1])) return false;
  if (Number(parts[1]) <= now) return false;
  const expected = Buffer.from(sign(password, `${parts[0]}.${parts[1]}`));
  const given = Buffer.from(parts[2]);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Where to go after signing in: a path inside the private area, or the private home. Anything
 * else (another site, `//evil.com`, `/\evil.com`, the sign-in page itself) is ignored.
 */
export function safeNext(next: string | null | undefined): string {
  const fallback = SESSION_PATH;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  let url: URL;
  try {
    url = new URL(next, "http://x.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://x.invalid") return fallback;
  const inside = url.pathname === SESSION_PATH || url.pathname.startsWith(`${SESSION_PATH}/`);
  if (!inside || url.pathname === SIGN_IN_PATH) return fallback;
  return url.pathname + url.search + url.hash;
}
