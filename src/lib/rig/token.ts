import "server-only";
import { bearerOk } from "./bearer";

/**
 * The Vectorworks connector's key for /api/rig/*: `RIG_TOKEN` in Vercel (Sensitive) and
 * `VWMCP_RIG_TOKEN` on the computer. Unset means nobody gets in (fail closed).
 */
export function rigTokenOk(req: Request): boolean {
  return bearerOk(req, process.env.RIG_TOKEN);
}

export const noStore = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
