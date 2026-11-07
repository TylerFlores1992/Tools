import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The Vectorworks connector's key for /api/rig/*: `RIG_TOKEN` in Vercel (Sensitive) and
 * `VWMCP_RIG_TOKEN` on the computer. Unset means nobody gets in (fail closed).
 */
const sha = (s: string) => createHash("sha256").update(s).digest();

export function rigTokenOk(req: Request): boolean {
  const secret = process.env.RIG_TOKEN;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  return timingSafeEqual(sha(given), sha(`Bearer ${secret}`));
}

export const noStore = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
