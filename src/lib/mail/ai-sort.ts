import "server-only";
import { generateText, Output } from "ai";
import { AI_SCHEMA, aiPrompt, readAiReply, type AiVerdict } from "@/tools/mail/ai";
import type { IncomingMail } from "@/tools/mail/types";

/**
 * Asks the model where each email goes (src/tools/mail/ai.ts has the brief and the rules it can't
 * break). Vercel AI Gateway, the deployment's OIDC token, the team's free tier: Gemini 2.5 Flash
 * is allowed there, Claude models are not (docs/MONEY.md). `MAIL_AI_MODEL` switches the model;
 * `MAIL_AI=off` turns the read off and the code sorting runs alone.
 * Never throws: an unreachable model means the code's answer stands for those emails.
 */

export const MAIL_AI_MODEL = process.env.MAIL_AI_MODEL || "google/gemini-2.5-flash";
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
          model: MAIL_AI_MODEL,
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
