/**
 * Which AI reads a stub, and what to say when it can't. Pure, so it can be tested without a key.
 *
 * Since 2026-10-31 (owner's call) stubs go straight to Google on the free AI Studio key Morning
 * Mail uses (`MONEY_GEMINI_API_KEY`, else `MAIL_GEMINI_API_KEY`). Vercel's AI Gateway, which read
 * them before, ran out of free credit and refused every read ("A positive credit balance is
 * required"). Google's free tier may use what is sent to improve its products, and a stub photo
 * can't be masked the way Mail masks long numbers: the owner accepted that for stubs too.
 * With no key the gateway is still tried, so a top-up there brings it back with no code change.
 */

export type ReadRoute = { via: "gemini"; models: readonly string[] } | { via: "gateway"; models: readonly string[] };

type Env = { readonly [name: string]: string | undefined };

export const geminiKey = (env: Env) => env.MONEY_GEMINI_API_KEY || env.MAIL_GEMINI_API_KEY || undefined;

/**
 * The models to try, in order. Flash-Lite first, as Mail and Learn do: on 2026-10-31 full Flash
 * took over 30 s on a real stub photo and timed out, leaving Lite too little time to finish.
 * Flash is the fallback when Lite fails or its quota is used up. The owner reviews every field.
 */
export function readRoute(env: Env): ReadRoute {
  if (geminiKey(env)) {
    const models = [env.MONEY_GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-lite-latest"].filter(
      (m, i, a): m is string => !!m && a.indexOf(m) === i,
    );
    return { via: "gemini", models };
  }
  return { via: "gateway", models: [env.MONEY_STUB_MODEL || "google/gemini-2.5-flash"] };
}

/** One plain sentence for the stub's page, from the last error of the last model tried. */
export function readFailureMessage(err: { name?: string; message?: string } | null | undefined): string {
  const name = err?.name ?? "";
  const msg = err?.message ?? "";
  if (name === "TimeoutError" || name === "AbortError") return "Reading took too long. Try a closer, flatter photo, or enter it by hand.";
  if (/positive credit balance|insufficient.?(credit|funds)|top.?up/i.test(msg)) return "The AI service is out of credit, so nothing could read the stub. Enter it by hand, or see docs/MONEY.md.";
  if (/high demand|overloaded|unavailable|\b503\b/i.test(msg)) return "Google's AI is busy right now. Try again in a few minutes, or enter it by hand.";
  if (/quota|rate.?limit|resource.?exhausted|\b429\b/i.test(msg)) return "Today's free AI reads are used up. Try again tomorrow, or enter it by hand.";
  if (/api.?key|auth|\b401\b|\b403\b|oidc|permission/i.test(msg)) return "The AI service didn't accept this site's key. Check MONEY_GEMINI_API_KEY in Vercel (docs/MONEY.md), or enter it by hand.";
  return "The stub couldn't be read. Try another photo, or enter it by hand.";
}

/**
 * Uploading a file that is already on file: read it again if the earlier read failed or never
 * finished (a timed-out read can leave "reading" behind); skip it once it read or was saved.
 */
export const retryOnUpload = (status: string | null | undefined) => status === "failed" || status === "reading";
