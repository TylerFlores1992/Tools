import { NextResponse } from "next/server";
import { requirePrivate } from "@/lib/money/guard";
import { callRunner, runnerMissingMessage } from "@/lib/course/runner";

export async function GET() {
  await requirePrivate("/private/course");
  const res = await callRunner("state");
  if (!res?.ok) return NextResponse.json({ error: runnerMissingMessage() }, { status: 503 });
  return NextResponse.json(await res.json(), { headers: { "cache-control": "no-store" } });
}
