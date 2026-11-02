import { NextResponse } from "next/server";
import { requirePrivate } from "@/lib/money/guard";
import { callRunner, runnerMissingMessage } from "@/lib/course/runner";

/** The course window as it is right now. Passed straight through; nothing is stored. */
export async function GET() {
  await requirePrivate("/private/course");
  const res = await callRunner("screen");
  if (!res?.ok) return NextResponse.json({ error: runnerMissingMessage() }, { status: 503 });
  return new Response(await res.arrayBuffer(), { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
}
