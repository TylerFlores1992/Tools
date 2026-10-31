import "server-only";

/**
 * Talks to the home DVR (the recorder on the home server) from Vercel's servers. The home server
 * is not on the internet; Tailscale Funnel publishes ONE locked entrance to it, which serves the
 * recordings API only and answers nothing without the key.
 *
 * - `DVR_URL`: the entrance, e.g. https://home-server.<tailnet>.ts.net/dvr
 * - `DVR_TOKEN`: its key (Vercel, Sensitive). Never sent to the browser, never logged.
 *
 * Unset = "not configured" (fail closed). Errors the browser sees are plain words, never
 * internals: the recorder's own messages are written for people ("That airing is already set to
 * record."), and anything else becomes a generic line.
 */

export type DvrResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not-configured" | "unreachable" | "refused" | "rejected"; message: string };

export const dvrConfigured = () => Boolean(process.env.DVR_URL && process.env.DVR_TOKEN);

const UNREACHABLE = "Couldn’t reach the DVR at home. It may be restarting; try again in a minute.";

export async function dvr<T>(path: string, init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<DvrResult<T>> {
  const base = process.env.DVR_URL?.replace(/\/+$/, "");
  const token = process.env.DVR_TOKEN;
  if (!base || !token) return { ok: false, reason: "not-configured", message: "The DVR isn’t connected to this site yet." };
  const method = init.method ?? "GET";
  try {
    const res = await fetch(`${base}/api/dvr/${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(method === "GET" ? {} : { "content-type": "application/json" }) },
      body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (res.ok && json !== null) return { ok: true, data: json };
    if (res.status === 401) return { ok: false, reason: "refused", message: "The DVR didn’t accept this site’s key." };
    // 4xx from the recorder carry a message written for people; 5xx and the rest don't.
    if (res.status >= 400 && res.status < 500 && typeof json?.error === "string") return { ok: false, reason: "rejected", message: json.error.slice(0, 200) };
    return { ok: false, reason: "unreachable", message: UNREACHABLE };
  } catch {
    return { ok: false, reason: "unreachable", message: UNREACHABLE };
  }
}
