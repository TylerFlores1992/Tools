import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries `Authorization: Bearer <secret>`, compared in constant time. Unset or
 * empty secret means no (fail closed). Shared by /api/rig/* and Proxy's connector-file exception.
 */
const sha = (s: string) => createHash("sha256").update(s).digest();

export function bearerOk(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  return timingSafeEqual(sha(given), sha(`Bearer ${secret}`));
}

/** The connector's own files under /private, which it fetches with its key (no browser session). */
export const CONNECTOR_FILES = new Set(["/private/vectorworks/vwmcp-win.json", "/private/vectorworks/vwmcp-win.zip", "/private/vectorworks/symbols.json"]);
