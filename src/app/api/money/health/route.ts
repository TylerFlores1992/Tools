import { timingSafeEqual } from "node:crypto";
import { generateText, Output } from "ai";
import { isConfigured, sql } from "@/lib/money/db";
import { STUB_MODEL } from "@/lib/money/income/read-document";
import { READ_PROMPT, READ_SCHEMA } from "@/tools/money/income/read";

/**
 * Says only whether the money database answers: "ok", "not set" or "unreachable". No data, no
 * error details. `?parallel=1` also runs three reads at once on the shared connection, the way a
 * page does, and reports "ok" or "stalled" (a probe for the pooler hang of 2026-10-18).
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  // `?ai=<MONEY_PROBE_KEY>`: can this deployment reach the AI Gateway and read a stub? It sends a
  // made-up stub as text (no real data) and answers ok/failed with the gross it read. Behind a key
  // because each call costs a little.
  const probe = new URL(request.url).searchParams.get("ai");
  if (probe !== null) {
    const key = process.env.MONEY_PROBE_KEY;
    if (!key || probe.length !== key.length || !timingSafeEqual(Buffer.from(probe), Buffer.from(key))) return Response.json({ ai: "unauthorized" }, { status: 401, headers });
    const started = Date.now();
    try {
      const { output } = await generateText({
        model: STUB_MODEL,
        output: Output.object({ schema: READ_SCHEMA }),
        abortSignal: AbortSignal.timeout(45_000),
        prompt: `${READ_PROMPT}\n\nThe document, as text:\nACME PAYROLL check date 10/16/2026 week ending 10/11/2026. Straight Time 8.00 hrs @ 52.00 = 416.00. Overtime 1.5x 4.00 hrs @ 78.00 = 312.00. Gross 728.00. Federal 59.00, Social Security 45.14, Medicare 10.56, CA SDI 9.46, CA PIT 17.00. Net 586.84.`,
      });
      return Response.json({ ai: "ok", model: STUB_MODEL, gross: output.grossPay, net: output.netPay, lines: output.earnings.length, ms: Date.now() - started }, { headers });
    } catch (e) {
      return Response.json({ ai: "failed", model: STUB_MODEL, error: e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : "unknown", ms: Date.now() - started }, { status: 502, headers });
    }
  }
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
