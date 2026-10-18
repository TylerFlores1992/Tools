import { timingSafeEqual, createHash } from "node:crypto";
import { isConfigured } from "@/lib/money/db";
import { runSync } from "@/lib/money/sync";

/**
 * The daily bank sync, called by Vercel Cron (vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else gets 401. With CRON_SECRET unset the route
 * refuses everyone (fail closed). Answers with counts only, never transactions.
 */
export const maxDuration = 60;

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(sha(given), sha(`Bearer ${secret}`))) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isConfigured()) return Response.json({ ok: false, message: "Database not configured." }, { status: 503 });
  try {
    const r = await runSync("cron");
    return Response.json({ ok: r.ok, accounts: r.accounts, newTxns: r.newTxns, message: r.message }, { status: r.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, message: "Couldn't reach the database." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
