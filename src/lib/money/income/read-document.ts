import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, type LanguageModel, type ModelMessage } from "ai";
import { READ_PROMPT, READ_SCHEMA, type ReadResult } from "@/tools/money/income/read";
import { geminiKey, readFailureMessage, readRoute } from "@/tools/money/income/read-models";

/**
 * Reads a stub or W-2 photo/PDF with a vision model (the owner's call, 2026-10-19: "Use AI").
 * Straight to Google on the free Gemini key since 2026-10-31; Vercel's AI Gateway only when no
 * key is set (read-models.ts says why and what the owner accepted). Only the document goes to the
 * model, and its answer is a proposal: the owner reviews every field.
 */

export class ReadFailed extends Error {}

const TOTAL_MS = 50_000; // the page's action has 60 s
const PER_TRY_MS = 30_000;

function modelFor(id: string): LanguageModel {
  const key = geminiKey(process.env);
  return key ? createGoogleGenerativeAI({ apiKey: key })(id) : id;
}

/** Tries each model in turn until one answers. Throws ReadFailed with a sentence for the page. */
export async function runRead(messages: ModelMessage[]): Promise<{ result: ReadResult; model: string }> {
  const { models } = readRoute(process.env);
  const deadline = Date.now() + TOTAL_MS;
  let last: unknown = null;
  for (const id of models) {
    const left = deadline - Date.now();
    if (left < 5_000) break;
    try {
      const { output } = await generateText({
        model: modelFor(id),
        output: Output.object({ schema: READ_SCHEMA }),
        abortSignal: AbortSignal.timeout(Math.min(PER_TRY_MS, left)),
        maxRetries: 0,
        messages,
      });
      return { result: output, model: id };
    } catch (e) {
      last = e;
      console.error("money stub read failed", id, e instanceof Error ? `${e.name}: ${e.message.slice(0, 200)}` : "unknown");
    }
  }
  throw new ReadFailed(readFailureMessage(last instanceof Error ? last : null));
}

export async function readDocument(bytes: Buffer, mime: string): Promise<{ result: ReadResult; model: string }> {
  return runRead([
    {
      role: "user",
      content: [
        { type: "text", text: READ_PROMPT },
        { type: "file", data: bytes, mediaType: mime },
      ],
    },
  ]);
}
