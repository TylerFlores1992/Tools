import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SIGN_IN_PATH, verifySession } from "@/lib/private-auth";

/**
 * A second lock on the money pages and actions. src/proxy.ts already guards /private, but bank
 * data gets checked again where it's read and written, so a proxy mistake can't expose it.
 */
export async function requirePrivate(next = "/private/money"): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token, process.env.LAB_PASSWORD)) {
    redirect(`${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`);
  }
}
