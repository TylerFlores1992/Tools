import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { EDIT_SCHEMA, type RigEdit } from "@/tools/rig/commands";
import { TEMPLATES } from "@/tools/rig/templates";
import type { RigDesign } from "@/tools/rig/types";

/**
 * Reads a rigging request the plain-words parser couldn't, on the same free Gemini key as Learn
 * and Morning Mail (`RIG_GEMINI_API_KEY`, else `MAIL_GEMINI_API_KEY`). Only the design and the
 * message are sent. The answer is an edit in the parser's own shape, applied by `applyEdit`, so
 * the AI can't produce a design the templates don't allow. Never throws; null means "not now".
 */
const KEY = process.env.RIG_GEMINI_API_KEY || process.env.MAIL_GEMINI_API_KEY;
const MODELS = [process.env.RIG_GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-lite-latest"].filter(
  (m, i, a): m is string => !!m && a.indexOf(m) === i,
);

export const rigAiReady = () => Boolean(KEY) && process.env.RIG_AI !== "off";

export function rigPrompt(design: RigDesign, message: string): string {
  const templates = TEMPLATES.map((t) => `- ${t.id} (${t.name}): ${t.blurb} Settings: ${t.fields.map((f) => f.key).join(", ")}.`).join("\n");
  return [
    "You help a film/TV rigging grip plan ground-support and flown truss rigs, and stages built from rental decks.",
    "Turn their message into ONE edit of the current design. Lengths are INCHES (10 ft = 120).",
    "Set a field only if the message asks to change it; leave the rest null.",
    "series: box12 = 12 inch box truss, box20 = 20.5 inch box truss.",
    "braces: knee braces (45 degree pipes with cheeseboroughs) — none, top, bottom or both.",
    "Stage (template stage): 4x8 decks on legs. height = deck height in inches (8 to 60, 4 inch steps); width/depth in 4 ft steps.",
    "skirt: true/false (front and both sides). rail: none, back, or three (back and both sides; the front stays open). stairs: 0, 1 or 2 stair units on the front.",
    "Templates:",
    templates,
    "If the request can't be done with these templates and settings, change nothing and say so plainly in `reply`.",
    "`reply` is one short sentence to the grip, plain words, no jargon they wouldn't use.",
    `Current design: ${JSON.stringify(design)}`,
    `Message: ${message.slice(0, 500)}`,
  ].join("\n");
}

export async function aiEdit(design: RigDesign, message: string): Promise<RigEdit | null> {
  if (!rigAiReady()) return null;
  const google = createGoogleGenerativeAI({ apiKey: KEY });
  const deadline = Date.now() + 20_000;
  for (const id of MODELS) {
    const left = deadline - Date.now();
    if (left < 3_000) return null;
    try {
      const { output } = await generateText({
        model: google(id),
        output: Output.object({ schema: EDIT_SCHEMA }),
        abortSignal: AbortSignal.timeout(Math.min(10_000, left)),
        maxRetries: 0,
        prompt: rigPrompt(design, message),
      });
      return output;
    } catch (e) {
      console.error("rig ai failed", id, e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : "unknown");
    }
  }
  return null;
}
