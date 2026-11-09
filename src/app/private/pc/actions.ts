"use server";

import { requirePrivate } from "@/lib/money/guard";
import { waker, type PcStatus, type PcWake } from "@/lib/pc/waker";

export type WakeResult = { ok: boolean; message: string; sentAt: number | null; awake: boolean };

/** Sends the wake packet through the home server. Re-checks the Private session itself. */
export async function wakePc(_: WakeResult | null): Promise<WakeResult> {
  await requirePrivate("/private/pc");
  const r = await waker<PcWake>("wake");
  if (!r.ok) return { ok: false, message: r.message, sentAt: null, awake: false };
  return { ok: true, message: r.data.message.slice(0, 200), sentAt: r.data.sent ? Date.now() : null, awake: r.data.awake };
}

/** Whether the PC answers right now (polled by the page while it wakes). */
export async function pcAwake(): Promise<{ ok: boolean; awake: boolean; message?: string }> {
  await requirePrivate("/private/pc");
  const r = await waker<PcStatus>("status");
  return r.ok ? { ok: true, awake: r.data.awake } : { ok: false, awake: false, message: r.message };
}
