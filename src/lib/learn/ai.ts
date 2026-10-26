import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { GRADE_SCHEMA, gradePrompt, readGrade, type Grade } from "@/tools/learn/grade";
import type { ExplainStep } from "@/tools/learn/types";

/**
 * Marks an explanation with Gemini on the free Google AI Studio key (owner's pick, 2026-10-26:
 * "free Gemini or free Claude"; Claude's API has no free tier). `LEARN_GEMINI_API_KEY` if set,
 * otherwise Morning Mail's `MAIL_GEMINI_API_KEY`. Google's free tier may use what is sent to
 * improve its products: only the lesson text and the learner's answer go, nothing personal.
 * Never throws: no key, no quota or a slow model returns null and the page falls back to marking
 * yourself against the rubric.
 */

const KEY = process.env.LEARN_GEMINI_API_KEY || process.env.MAIL_GEMINI_API_KEY;
// Same order Morning Mail settled on (src/lib/mail/ai-sort.ts): Lite first, most free quota.
const MODELS = [process.env.LEARN_GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-lite-latest"].filter(
  (m, i, a): m is string => !!m && a.indexOf(m) === i,
);
const PER_TRY_MS = 12_000;

export const aiMarkerReady = () => Boolean(KEY) && process.env.LEARN_AI !== "off";

export async function markExplanation(step: ExplainStep, answer: string): Promise<Grade | null> {
  if (!aiMarkerReady()) return null;
  const google = createGoogleGenerativeAI({ apiKey: KEY });
  const deadline = Date.now() + 25_000;
  for (const id of MODELS) {
    const left = deadline - Date.now();
    if (left < 3_000) return null;
    try {
      const { output } = await generateText({
        model: google(id),
        output: Output.object({ schema: GRADE_SCHEMA }),
        abortSignal: AbortSignal.timeout(Math.min(PER_TRY_MS, left)),
        maxRetries: 0,
        prompt: gradePrompt(step, answer),
      });
      return readGrade(step, output);
    } catch (e) {
      console.error("learn ai mark failed", id, e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : "unknown");
    }
  }
  return null;
}
