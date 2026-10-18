import { isConfigured, sql } from "@/lib/money/db";

/**
 * Says only whether the money database answers: "ok", "not set" or "unreachable". No data, no
 * error details. Used to check a deploy (`npm run smoke`) without signing in.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (!isConfigured()) return Response.json({ database: "not set" }, { headers });
  try {
    await sql()`select 1 from money.settings limit 1`;
    return Response.json({ database: "ok" }, { headers });
  } catch {
    return Response.json({ database: "unreachable" }, { status: 503, headers });
  }
}
