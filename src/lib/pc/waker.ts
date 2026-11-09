import "server-only";

/**
 * Talks to the PC waker on the home server (connectors/pc-waker) from Vercel's servers, through
 * its one Tailscale Funnel path. It can only wake the main PC and say whether it answers.
 *
 * - `PC_WAKER_URL`: e.g. https://home-server.<tailnet>.ts.net/pc
 * - `PC_WAKER_TOKEN`: its key (Vercel, Sensitive). Never sent to the browser, never logged.
 *
 * Unset = "not configured" (fail closed).
 */
export type PcStatus = { awake: boolean; name: string; lastWake: number | null; at: number };
export type PcWake = { sent: boolean; awake: boolean; message: string };
export type WakerResult<T> = { ok: true; data: T } | { ok: false; reason: "not-configured" | "unreachable" | "refused"; message: string };

export const wakerConfigured = () => Boolean(process.env.PC_WAKER_URL && process.env.PC_WAKER_TOKEN);

const UNREACHABLE = "Couldn’t reach the home server. It may be restarting; try again in a minute.";

export async function waker<T>(path: "status" | "wake"): Promise<WakerResult<T>> {
  const base = process.env.PC_WAKER_URL?.replace(/\/+$/, "");
  const token = process.env.PC_WAKER_TOKEN;
  if (!base || !token) return { ok: false, reason: "not-configured", message: "The PC waker isn’t connected to this site yet." };
  try {
    const res = await fetch(`${base}/${path}`, {
      method: path === "wake" ? "POST" : "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const json = (await res.json().catch(() => null)) as T | null;
    if (res.ok && json !== null) return { ok: true, data: json };
    if (res.status === 401) return { ok: false, reason: "refused", message: "The home server didn’t accept this site’s key." };
    return { ok: false, reason: "unreachable", message: UNREACHABLE };
  } catch {
    return { ok: false, reason: "unreachable", message: UNREACHABLE };
  }
}
