import { createHash, timingSafeEqual } from "node:crypto";
import { isConfigured } from "@/lib/money/db";
import { runYahoo } from "@/lib/mail/run";

/**
 * The 7 am Morning Mail run (Vercel Cron, vercel.json). Needs `Authorization: Bearer $CRON_SECRET`;
 * unset refuses everyone. Answers with a sentence and counts, never mail.
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
    const r = await runYahoo("cron");
    return Response.json(r, { status: r.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, message: "The run failed before it finished." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
