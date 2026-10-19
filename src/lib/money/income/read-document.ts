import "server-only";
import { generateText, Output } from "ai";
import { READ_PROMPT, READ_SCHEMA, type ReadResult } from "@/tools/money/income/read";

/**
 * Reads a stub or W-2 photo/PDF with a vision model through Vercel's AI Gateway (the owner's
 * call, 2026-10-19: "Use AI"). On Vercel the gateway is reached with the deployment's OIDC token,
 * so there is no key to store; AI_GATEWAY_API_KEY overrides it for local runs.
 * Only the document goes to the model. Its answer is a proposal: the owner reviews every field.
 */

export const STUB_MODEL = process.env.MONEY_STUB_MODEL || "google/gemini-2.5-flash";

export class ReadFailed extends Error {}

export async function readDocument(bytes: Buffer, mime: string): Promise<{ result: ReadResult; model: string }> {
  try {
    const { output } = await generateText({
      model: STUB_MODEL,
      output: Output.object({ schema: READ_SCHEMA }),
      abortSignal: AbortSignal.timeout(50_000),
      maxRetries: 1,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: READ_PROMPT },
            { type: "file", data: bytes, mediaType: mime },
          ],
        },
      ],
    });
    return { result: output, model: STUB_MODEL };
  } catch (e) {
    const name = e instanceof Error ? e.name : "unknown";
    console.error("money stub read failed", name, e instanceof Error ? e.message.slice(0, 200) : "");
    if (name === "TimeoutError" || name === "AbortError") throw new ReadFailed("Reading took too long. Try a closer, flatter photo, or enter it by hand.");
    if (/auth|401|403|oidc|token/i.test(e instanceof Error ? e.message : "")) throw new ReadFailed("The AI service didn't accept this site's sign-in. Set AI_GATEWAY_API_KEY in Vercel (docs/MONEY.md), or enter it by hand.");
    throw new ReadFailed("The stub couldn't be read. Try another photo, or enter it by hand.");
  }
}
