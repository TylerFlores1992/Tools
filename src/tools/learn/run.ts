"use client";

/**
 * Runs a lesson's JavaScript in a throwaway Web Worker: no page, no cookies-backed DOM, killed
 * after RUN_MS so an endless loop can't freeze the tab. Captures console.log/error lines and the
 * first thrown error, in the words JavaScript itself uses (reading errors is part of the skill).
 */

export const RUN_MS = 2000;

export type RunResult = { lines: string[]; error: string | null; timedOut: boolean };

const WORKER_SRC = `
const fmt = (v) => {
  if (typeof v === "string") return v;
  if (v === undefined) return "undefined";
  if (typeof v === "function") return "[Function]";
  try { return JSON.stringify(v); } catch { return String(v); }
};
const lines = [];
const out = (...a) => lines.push(a.map(fmt).join(" "));
console.log = out; console.info = out; console.warn = out; console.error = out;
self.onmessage = (e) => {
  let error = null;
  try { (0, eval)(e.data); }
  catch (err) { error = (err && err.name ? err.name + ": " : "") + (err && err.message ? err.message : String(err)); }
  self.postMessage({ lines, error });
};
`;

export function runCode(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    const w = new Worker(url);
    const done = (r: RunResult) => {
      clearTimeout(timer);
      w.terminate();
      URL.revokeObjectURL(url);
      resolve(r);
    };
    const timer = setTimeout(() => done({ lines: [], error: `Stopped after ${RUN_MS / 1000} seconds. Is there a loop that never ends?`, timedOut: true }), RUN_MS);
    w.onmessage = (e: MessageEvent<{ lines: string[]; error: string | null }>) => done({ ...e.data, timedOut: false });
    w.onerror = (e) => {
      e.preventDefault();
      done({ lines: [], error: e.message || "The code could not run.", timedOut: false });
    };
    w.postMessage(code);
  });
}
