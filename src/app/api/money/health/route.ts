import { isConfigured, sql } from "@/lib/money/db";

/**
 * Says only whether the money database answers: "ok", "not set" or "unreachable". No data, no
 * error details. `?parallel=1` also runs three reads at once on the shared connection, the way a
 * page does, and reports "ok" or "stalled" (a probe for the pooler hang of 2026-10-18).
 */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (!isConfigured()) return Response.json({ database: "not set" }, { headers });
  const parallel = new URL(request.url).searchParams.get("parallel") === "1";
  try {
    await sql()`select 1 from money.settings limit 1`;
    if (!parallel) return Response.json({ database: "ok" }, { headers });
    const started = Date.now();
    const reads = Promise.all([
      sql()`select count(*) from money.accounts`,
      sql()`select count(*) from money.transactions`,
      sql()`select count(*) from money.rules`,
    ]).then(() => "ok");
    const result = await Promise.race([reads, new Promise<string>((r) => setTimeout(() => r("stalled"), 12_000))]);
    return Response.json({ database: "ok", parallel: result, ms: Date.now() - started }, { headers });
  } catch {
    return Response.json({ database: "unreachable" }, { status: 503, headers });
  }
}
