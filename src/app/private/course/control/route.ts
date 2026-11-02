import { NextResponse } from "next/server";
import { requirePrivate } from "@/lib/money/guard";
import { callRunner, runnerMissingMessage } from "@/lib/course/runner";
import { CommandSchema, toRequest } from "@/tools/course/commands";

export async function POST(request: Request) {
  await requirePrivate("/private/course");
  const parsed = CommandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That request wasn’t understood." }, { status: 400 });
  const { path, body } = toRequest(parsed.data);
  const res = await callRunner(path, body);
  if (!res) return NextResponse.json({ error: runnerMissingMessage() }, { status: 503 });
  if (res.ok) return NextResponse.json({ ok: true });
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return NextResponse.json({ error: res.status < 500 && json?.error ? json.error.slice(0, 200) : runnerMissingMessage() }, { status: 502 });
}
