import "server-only";

/**
 * Talks to Page Turner on the home server (connectors/course-runner) from Vercel's servers, through
 * one locked Tailscale Funnel path.
 *
 * - `COURSE_URL`: the entrance, e.g. https://home-server.<tailnet>.ts.net/course
 * - `COURSE_TOKEN`: its key (Vercel, Sensitive). Never sent to the browser, never logged.
 *
 * Unset = not connected (fail closed).
 */
export const COURSE_NOT_CONNECTED = "Page Turner isn’t connected to this site yet.";
export const COURSE_UNREACHABLE = "Couldn’t reach Page Turner at home. Check that it’s running on the server.";

const entrance = () => {
  const base = process.env.COURSE_URL?.replace(/\/+$/, "");
  const token = process.env.COURSE_TOKEN;
  return base && token ? { base, token } : null;
};

/** Forwards one request and returns the home server's answer, or null if it can't be reached. */
export async function callRunner(path: string, body?: unknown): Promise<Response | null> {
  const e = entrance();
  if (!e) return null;
  try {
    return await fetch(`${e.base}/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${e.token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return null;
  }
}

export const runnerMissingMessage = () => (entrance() ? COURSE_UNREACHABLE : COURSE_NOT_CONNECTED);
