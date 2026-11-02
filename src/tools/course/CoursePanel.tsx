"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { STATUS_LABEL, type Command, type CourseState } from "./commands";

const POLL_MS = 3000;
const SCREEN_MS = 2500;

/** The phone side of Page Turner: status, controls and a live, tappable view of the course. */
export function CoursePanel() {
  const [state, setState] = useState<CourseState | null>(null);
  const [error, setError] = useState("");
  const [frame, setFrame] = useState(0);
  const [watching, setWatching] = useState(false);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  const lastStatus = useRef("");

  const refresh = useCallback(async () => {
    if (document.hidden) return;
    try {
      const res = await fetch("/private/course/state", { cache: "no-store" });
      if (res.redirected) { location.reload(); return; }
      const json = await res.json();
      if (!res.ok) { setError(json.error); setState(null); return; }
      setError("");
      setState(json);
    } catch {
      setError("Couldn’t reach this site. Check your connection.");
    }
  }, []);

  useEffect(() => {
    const start = setTimeout(refresh, 0);
    const t = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(start); clearInterval(t); document.removeEventListener("visibilitychange", refresh); };
  }, [refresh]);

  const status = state?.status;
  const showScreen = Boolean(state) && (watching || status === "needs-you" || status === "stopped");
  useEffect(() => {
    if (status && status !== lastStatus.current) { lastStatus.current = status; const t = setTimeout(() => setFrame((f) => f + 1), 0); return () => clearTimeout(t); }
  }, [status]);
  useEffect(() => {
    if (!showScreen) return;
    const t = setInterval(() => { if (!document.hidden) setFrame((f) => f + 1); }, SCREEN_MS);
    return () => clearInterval(t);
  }, [showScreen]);

  const send = async (c: Command) => {
    try {
      const res = await fetch("/private/course/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
      const json = await res.json().catch(() => ({}));
      setError(res.ok ? "" : json.error ?? "That didn’t go through.");
      return res.ok;
    } catch {
      setError("Couldn’t reach this site. Check your connection.");
      return false;
    } finally {
      setFrame((f) => f + 1);
      void refresh();
    }
  };

  const onTap = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setTap({ x, y });
    setTimeout(() => setTap(null), 700);
    void send({ kind: "tap", x, y });
  };

  if (!state) {
    return (
      <Card className="mt-8 max-w-[640px]">
        {error ? <State kind="wrong">{error}</State> : <State kind="note" sr={false}>Checking the home server…</State>}
      </Card>
    );
  }

  const running = status === "running" || status === "needs-you";
  return (
    <div className="mt-8 grid max-w-[960px] gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0" aria-live="polite">
            <Label>{STATUS_LABEL[state.status]}</Label>
            <p className="mt-2 text-h3 text-ink">
              {status === "needs-you" ? <State kind="wrong" sr="Needs you:">{state.message}</State> : state.message}
            </p>
            <p className="mt-1 break-words text-small text-muted">
              {state.title || "No course open"} · {state.clicks} {state.clicks === 1 ? "page" : "pages"} turned
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {running ? <Button variant="quiet" onClick={() => send({ kind: "control", action: "pause" })}>Pause</Button>
              : <Button onClick={() => send({ kind: "control", action: "start" })}>{status === "paused" ? "Resume" : "Start"}</Button>}
            <Button variant="ghost" disabled={status === "stopped"} onClick={() => send({ kind: "control", action: "stop" })}>Stop</Button>
          </div>
        </div>
        {error && <p className="mt-3 text-small"><State kind="wrong">{error}</State></p>}
      </Card>

      {!showScreen && <div><Button variant="quiet" onClick={() => setWatching(true)}>Show the course</Button></div>}

      {showScreen && (
        <Card className="grid gap-4">
          <p className="text-small text-ink-2">Tap the picture to click there. Pinch to zoom in.</p>
          <button type="button" onClick={onTap} aria-label="Course screen. Tap to click at that spot." className="relative block w-full overflow-hidden rounded-tag border border-control">
            {/* A live feed: next/image would only get in the way. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/private/course/screen?f=${frame}`} alt="The course as it looks right now" width={1100} height={800} className="block h-auto w-full" />
            {tap && <span aria-hidden="true" className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ember" style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%` }} />}
          </button>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => send({ kind: "scroll", dy: -500 })}>Scroll up</Button>
            <Button variant="quiet" onClick={() => send({ kind: "scroll", dy: 500 })}>Scroll down</Button>
            <Button variant="ghost" onClick={() => send({ kind: "key", key: "Enter" })}>Press Enter</Button>
            {watching && <Button variant="ghost" onClick={() => setWatching(false)}>Hide the course</Button>}
          </div>
          <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (text && (await send({ kind: "type", text }))) setText(""); }}>
            <label htmlFor="course-type" className="sr-only">Text to type</label>
            <input id="course-type" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="Tap a box, then type here" className="min-h-11 min-w-0 flex-1 basis-56 rounded-input border border-control bg-surface px-4 text-body text-ink" />
            <Button variant="quiet" type="submit">Type it</Button>
          </form>
          <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (url && (await send({ kind: "open", url }))) setUrl(""); }}>
            <label htmlFor="course-url" className="sr-only">Course address</label>
            <input id="course-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" placeholder="https://your-course-address" className="min-h-11 min-w-0 flex-1 basis-56 rounded-input border border-control bg-surface px-4 text-body text-ink" />
            <Button variant="quiet" type="submit">Open</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
