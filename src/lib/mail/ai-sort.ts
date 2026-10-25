import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, type LanguageModel } from "ai";
import { AI_SCHEMA, aiPrompt, readAiReply, type AiVerdict } from "@/tools/mail/ai";
import type { IncomingMail } from "@/tools/mail/types";

/**
 * Asks the model where each email goes (src/tools/mail/ai.ts has the brief and the rules it can't
 * break). Two routes, chosen by what's set in Vercel:
 *  - `MAIL_GEMINI_API_KEY` (a free Google AI Studio key; owner's pick, 2026-10-24, after the
 *    Vercel gateway's free credit ran out): Google's Gemini API directly, model
 *    `MAIL_GEMINI_MODEL` first if set, then Flash, then Flash-Lite (`MAIL_AI_MODELS`). Google's free tier may use what is sent
 *    to improve its products, which is why the prompt masks long numbers (`aiPrompt`).
 *  - otherwise Vercel AI Gateway (`MAIL_AI_MODEL`, default `google/gemini-2.5-flash`), which needs
 *    gateway credit.
 * `MAIL_AI=off` turns the read off and the code sorting runs alone.
 * Never throws: an unreachable model means the code's answer stands for those emails.
 */

const GEMINI_KEY = process.env.MAIL_GEMINI_API_KEY;
// Tried in order. On 2026-10-25 the first try on the free key got "this model is currently
// experiencing high demand" from gemini-flash-latest for most requests; Flash-Lite has more free
// capacity and is plenty for sorting.
export const MAIL_AI_MODELS: readonly string[] = GEMINI_KEY
  ? [process.env.MAIL_GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"].filter((m, i, a): m is string => !!m && a.indexOf(m) === i)
  : [process.env.MAIL_AI_MODEL || "google/gemini-2.5-flash"];
const model = (id: string): LanguageModel => (GEMINI_KEY ? createGoogleGenerativeAI({ apiKey: GEMINI_KEY })(id) : id);
const CHUNK = 20;
const AT_ONCE = 4;
const PER_TRY_MS = 15_000;
// The page and the morning run both stop at 60 s; whatever isn't sorted by then keeps the code's answer.
const BUDGET_MS = 42_000; // the re-sort; the morning run passes less (two Yahoo accounts share its 60 s)

export async function aiSort(mails: readonly IncomingMail[], budgetMs = BUDGET_MS): Promise<Map<string, AiVerdict>> {
  const out = new Map<string, AiVerdict>();
  if (!mails.length || process.env.MAIL_AI === "off") return out;
  const deadline = Date.now() + budgetMs;
  const chunks: IncomingMail[][] = [];
  for (let i = 0; i < mails.length; i += CHUNK) chunks.push(mails.slice(i, i + CHUNK));
  const work = async (chunk: IncomingMail[]) => {
    for (const id of MAIL_AI_MODELS) {
      const left = deadline - Date.now();
      if (left < 3_000) return;
      try {
        const { output } = await generateText({
          model: model(id),
          output: Output.object({ schema: AI_SCHEMA }),
          abortSignal: AbortSignal.timeout(Math.min(PER_TRY_MS, left)),
          maxRetries: 0,
          // Thinking off: sorting doesn't need it and it is most of the wait. The gateway may serve
          // Gemini from Google AI or Vertex; each reads its own key.
          providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } }, vertex: { thinkingConfig: { thinkingBudget: 0 } } },
          prompt: aiPrompt(chunk),
        });
        for (const [mid, v] of readAiReply(output, chunk)) out.set(mid, v);
        return;
      } catch (e) {
        console.error("mail ai sort failed", id, chunk.length, e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : "unknown");
      }
    }
  };
  for (let i = 0; i < chunks.length; i += AT_ONCE) await Promise.all(chunks.slice(i, i + AT_ONCE).map(work));
  return out;
}
