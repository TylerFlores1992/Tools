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
const CHUNK = 40;

export async function aiSort(mails: readonly IncomingMail[]): Promise<Map<string, AiVerdict>> {
  const out = new Map<string, AiVerdict>();
  if (!mails.length || process.env.MAIL_AI === "off") return out;
  const chunks: IncomingMail[][] = [];
  for (let i = 0; i < mails.length; i += CHUNK) chunks.push(mails.slice(i, i + CHUNK));
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { output } = await generateText({
          model: MAIL_AI_MODEL,
          output: Output.object({ schema: AI_SCHEMA }),
          abortSignal: AbortSignal.timeout(25_000),
          maxRetries: 1,
          prompt: aiPrompt(chunk),
        });
        for (const [id, v] of readAiReply(output, chunk)) out.set(id, v);
      } catch (e) {
        console.error("mail ai sort failed", e instanceof Error ? `${e.name}: ${e.message.slice(0, 200)}` : "unknown");
      }
    }),
  );
  return out;
}
