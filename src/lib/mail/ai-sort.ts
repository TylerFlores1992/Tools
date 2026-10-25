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
 *    `MAIL_GEMINI_MODEL` (default `gemini-flash-latest`). Google's free tier may use what is sent
 *    to improve its products, which is why the prompt masks long numbers (`aiPrompt`).
 *  - otherwise Vercel AI Gateway (`MAIL_AI_MODEL`, default `google/gemini-2.5-flash`), which needs
 *    gateway credit.
 * `MAIL_AI=off` turns the read off and the code sorting runs alone.
 * Never throws: an unreachable model means the code's answer stands for those emails.
 */

const GEMINI_KEY = process.env.MAIL_GEMINI_API_KEY;
export const MAIL_AI_MODEL = GEMINI_KEY ? process.env.MAIL_GEMINI_MODEL || "gemini-flash-latest" : process.env.MAIL_AI_MODEL || "google/gemini-2.5-flash";
const model = (): LanguageModel => (GEMINI_KEY ? createGoogleGenerativeAI({ apiKey: GEMINI_KEY })(MAIL_AI_MODEL) : MAIL_AI_MODEL);
// Gemini Flash answering for 40 emails at once took over 25 s and timed out (2026-10-24, the
// first re-sort). Smaller requests, two at a time, thinking off: each answers in a few seconds.
const CHUNK = 20;
const AT_ONCE = 2;

export async function aiSort(mails: readonly IncomingMail[]): Promise<Map<string, AiVerdict>> {
  const out = new Map<string, AiVerdict>();
  if (!mails.length || process.env.MAIL_AI === "off") return out;
  const chunks: IncomingMail[][] = [];
  for (let i = 0; i < mails.length; i += CHUNK) chunks.push(mails.slice(i, i + CHUNK));
  const work = async (chunk: IncomingMail[]) => {
      try {
        const { output } = await generateText({
          model: model(),
          output: Output.object({ schema: AI_SCHEMA }),
          abortSignal: AbortSignal.timeout(30_000),
          maxRetries: 0,
          // The gateway may serve Gemini from Google AI or Vertex; each reads its own key.
          providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } }, vertex: { thinkingConfig: { thinkingBudget: 0 } } },
          prompt: aiPrompt(chunk),
        });
        for (const [id, v] of readAiReply(output, chunk)) out.set(id, v);
      } catch (e) {
        console.error("mail ai sort failed", chunk.length, e instanceof Error ? `${e.name}: ${e.message.slice(0, 200)}` : "unknown");
      }
  };
  for (let i = 0; i < chunks.length; i += AT_ONCE) await Promise.all(chunks.slice(i, i + AT_ONCE).map(work));
  return out;
}
