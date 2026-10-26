"use client";

/**
 * Runs a lesson's JavaScript in a throwaway Web Worker, killed after RUN_MS so an endless loop
 * can't freeze the tab. Captures console.log/error lines and the first thrown error, in the words
 * JavaScript itself uses (reading errors is part of the skill).
 *
 * Isolation: the worker is loaded from a data: URL, which gives it an opaque origin, not the
 * site's. So code pasted in here can't use the Private session: the session cookie is SameSite=Lax
 * (not sent cross-site), responses are CORS-blocked, and Server Actions refuse a "null" origin. As
 * a second lock, the network and worker APIs are removed before the code runs. Async output (after
 * setTimeout/await) is not captured: the worker reports as soon as the code returns.
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
for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "Worker", "SharedWorker", "indexedDB", "caches", "BroadcastChannel"]) {
  try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }); } catch {}
}
self.onmessage = (e) => {
  let error = null;
  try { (0, eval)(e.data); }
  catch (err) { error = (err && err.name ? err.name + ": " : "") + (err && err.message ? err.message : String(err)); }
  self.postMessage({ lines, error });
};
`;

export function runCode(code: string): Promise<RunResult> {
  return start(code, true);
}

/**
 * A data: URL first (opaque origin). If this browser won't load a worker from one (load error before
 * any reply), try once more from a blob: URL, where the removed network APIs are the lock that's left.
 */
function start(code: string, opaque: boolean): Promise<RunResult> {
  return new Promise((resolve) => {
    let w: Worker;
    let blobUrl: string | null = null;
    try {
      if (opaque) w = new Worker(`data:text/javascript;charset=utf-8,${encodeURIComponent(WORKER_SRC)}`);
      else {
        blobUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
        w = new Worker(blobUrl);
      }
    } catch {
      if (opaque) return resolve(start(code, false));
      return resolve({ lines: [], error: "This browser couldn't start the code runner.", timedOut: false });
    }
    const done = (r: RunResult) => {
      clearTimeout(timer);
      w.terminate();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      resolve(r);
    };
    const timer = setTimeout(() => done({ lines: [], error: `Stopped after ${RUN_MS / 1000} seconds. Is there a loop that never ends?`, timedOut: true }), RUN_MS);
    w.onmessage = (e: MessageEvent<{ lines: string[]; error: string | null }>) => done({ ...e.data, timedOut: false });
    w.onerror = (e) => {
      e.preventDefault();
      if (opaque) {
        clearTimeout(timer);
        w.terminate();
        resolve(start(code, false));
        return;
      }
      done({ lines: [], error: e.message || "The code could not run.", timedOut: false });
    };
    w.postMessage(code);
  });
}
