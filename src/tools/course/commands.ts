import { z } from "zod";

/** Everything the Course page may ask the home server to do. Anything else stops at the site. */
export const CommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("control"), action: z.enum(["start", "pause", "stop"]) }),
  z.object({ kind: z.literal("tap"), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  z.object({ kind: z.literal("scroll"), dy: z.number().min(-2000).max(2000) }),
  z.object({ kind: z.literal("type"), text: z.string().min(1).max(500) }),
  z.object({ kind: z.literal("key"), key: z.enum(["Enter", "Tab", "Backspace"]) }),
  z.object({ kind: z.literal("open"), url: z.url({ protocol: /^https?$/ }).max(2000) }),
]);
export type Command = z.infer<typeof CommandSchema>;

export type CourseStatus = "stopped" | "paused" | "running" | "needs-you";
export type CourseState = { status: CourseStatus; message: string; clicks: number; title: string; updatedAt: number };

/** Splits a command into the home server's path and body. */
export function toRequest(c: Command): { path: string; body: Record<string, unknown> } {
  const { kind, ...body } = c;
  return { path: kind, body };
}

export const STATUS_LABEL: Record<CourseStatus, string> = {
  stopped: "Stopped",
  paused: "Paused",
  running: "Running",
  "needs-you": "Needs you",
};
