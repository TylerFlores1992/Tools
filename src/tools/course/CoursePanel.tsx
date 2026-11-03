"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { cx } from "@/components/cx";
import { Label } from "@/components/Label";
import { Spinner } from "@/components/Spinner";
import { State } from "@/components/State";
import { STATUS_LABEL, type Command, type CourseState, type CourseStatus } from "./commands";
import { dropExpected, nextPollDelay } from "./poll";

const SCREEN_MS = 2500;

/** What a pressed button says while its command is on its way, and the status it should lead to. */
type Sending = { id: string; words: string };

/** The phone side of Page Turner: status, controls and a live, tappable view of the course. */
export function CoursePanel() {
  const [state, setState] = useState<CourseState | null>(null);
  const [error, setError] = useState("");
  const [frame, setFrame] = useState(0);
  const [watching, setWatching] = useState(false);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  const [sending, setSending] = useState<Sending | null>(null);
  const [expected, setExpected] = useState<CourseStatus | null>(null);
  const [noPicture, setNoPicture] = useState(false);
  const lastStatus = useRef("");
  const inFlight = useRef<Promise<boolean> | null>(null);
  const busy = useRef(false); // a command is on its way: a second press waits for it
  // The status a command asked for stays on screen until the home server reports it. A poll that
  // started before the command (or within a grace after it) can't overrule it: its answer may
  // predate the command. Only a later poll that still disagrees means the command didn't take.
  const expectedRef = useRef<CourseStatus | null>(null);
  const commandDoneAt = useRef(0);
  const expect = useCallback((s: CourseStatus | null) => { expectedRef.current = s; setExpected(s); }, []);

  /** One look at the home server. Never two at once; true when it answered. */
  const refresh = useCallback((): Promise<boolean> => {
    if (document.hidden) return Promise.resolve(true);
    inFlight.current ??= (async () => {
      const started = Date.now();
      try {
        const res = await fetch("/private/course/state", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
        if (res.redirected) { location.reload(); return false; }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { setError(json.error ?? "The home server didn’t answer."); return false; } // keep the last state on screen
        setError("");
        setState(json);
        if (dropExpected({ asked: expectedRef.current, reported: json.status, sending: busy.current, pollStarted: started, commandDoneAt: commandDoneAt.current })) expect(null);
        return true;
      } catch {
        setError("Couldn’t reach this site. Check your connection.");
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [expect]);

  // Polls one after another (the next starts when the last has finished), slower after failures.
  useEffect(() => {
    let gen = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async (mine: number, failures: number) => {
      const ok = await refresh();
      if (mine !== gen) return;
      const f = ok ? 0 : failures + 1;
      timer = setTimeout(() => void loop(mine, f), nextPollDelay(f));
    };
    const restart = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      void loop(++gen, 0);
    };
    void loop(gen, 0);
    document.addEventListener("visibilitychange", restart);
    return () => { gen = -1; clearTimeout(timer); document.removeEventListener("visibilitychange", restart); };
  }, [refresh]);

  const status = expected ?? state?.status;
  const showScreen = Boolean(state) && (watching || status === "needs-you" || status === "stopped");
  useEffect(() => {
    if (status && status !== lastStatus.current) { lastStatus.current = status; const t = setTimeout(() => setFrame((f) => f + 1), 0); return () => clearTimeout(t); }
  }, [status]);
  useEffect(() => {
    if (!showScreen) return;
    const t = setInterval(() => { if (!document.hidden) setFrame((f) => f + 1); }, SCREEN_MS);
    return () => clearInterval(t);
  }, [showScreen]);

  /** Sends one command, marking the pressed button as working; a second press meanwhile does nothing. */
  const send = async (c: Command, s?: Sending, leadsTo?: CourseStatus) => {
    if (busy.current) return false;
    busy.current = true;
    if (s) setSending(s);
    if (leadsTo) expect(leadsTo);
    try {
      const res = await fetch("/private/course/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c), signal: AbortSignal.timeout(20_000) });
      const json = await res.json().catch(() => ({}));
      setError(res.ok ? "" : json.error ?? "That didn’t go through.");
      if (!res.ok) expect(null);
      return res.ok;
    } catch {
      setError("Couldn’t reach this site. Check your connection.");
      expect(null);
      return false;
    } finally {
      commandDoneAt.current = Date.now();
      busy.current = false;
      setSending(null);
      setFrame((f) => f + 1);
      void refresh();
    }
  };

  const onTap = (e: MouseEvent<HTMLButtonElement>) => {
    // Enter or Space on the picture fires a click at (0, 0): that is not a spot anyone chose.
    if (e.detail === 0 || noPicture) return;
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
      {error && (
        <p role="alert" className="text-small"><State kind="wrong">{error} What’s below is the last thing it said.</State></p>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0" aria-live="polite">
            <Label>{STATUS_LABEL[status ?? state.status]}</Label>
            <p className="mt-2 text-h3 text-ink">
              {status === "needs-you" ? <State kind="wrong" sr="Needs you:">{state.message}</State> : state.message}
            </p>
            <p className="mt-1 break-words text-small text-muted">
              {state.title || "No course open"} · {state.clicks} {state.clicks === 1 ? "page" : "pages"} turned
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Cmd id="pause" sending={sending} variant="quiet" onPress={() => void send({ kind: "control", action: "pause" }, { id: "pause", words: "Pausing…" }, "paused")}>Pause</Cmd>
            ) : (
              <Cmd id="start" sending={sending} variant="primary" onPress={() => void send({ kind: "control", action: "start" }, { id: "start", words: status === "paused" ? "Resuming…" : "Starting…" }, "running")}>
                {status === "paused" ? "Resume" : "Start"}
              </Cmd>
            )}
            <Cmd id="stop" sending={sending} variant="ghost" disabled={status === "stopped" && sending?.id !== "stop"} onPress={() => void send({ kind: "control", action: "stop" }, { id: "stop", words: "Stopping…" }, "stopped")}>Stop</Cmd>
          </div>
        </div>
      </Card>

      {!showScreen && <div><button type="button" onClick={() => setWatching(true)} className={buttonClasses("quiet")}>Show the course</button></div>}

      {showScreen && (
        <Card className="grid gap-4">
          <p className="text-small text-ink-2">Tap the picture to click there. Pinch to zoom in.</p>
          <button
            type="button"
            onClick={onTap}
            aria-label={noPicture ? "No picture of the course right now" : "Course screen. Tap to click at that spot."}
            aria-disabled={noPicture || undefined}
            className="relative block w-full overflow-hidden rounded-tag border border-control"
          >
            {/* A live feed: next/image would only get in the way. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/private/course/screen?f=${frame}`}
              alt="The course as it looks right now"
              width={1100}
              height={800}
              hidden={noPicture}
              onLoad={() => setNoPicture(false)}
              onError={() => setNoPicture(true)}
              className="block h-auto w-full"
            />
            {noPicture && (
              <span className="flex aspect-[11/8] w-full items-center justify-center bg-surface-2 p-6 text-center">
                <State kind="note" sr={false}>No picture right now. It tries again every few seconds.</State>
              </span>
            )}
            {tap && <span aria-hidden="true" className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ember" style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%` }} />}
          </button>
          <div className="flex flex-wrap gap-2">
            <Cmd id="up" sending={sending} variant="quiet" onPress={() => void send({ kind: "scroll", dy: -500 }, { id: "up", words: "Scrolling…" })}>Scroll up</Cmd>
            <Cmd id="down" sending={sending} variant="quiet" onPress={() => void send({ kind: "scroll", dy: 500 }, { id: "down", words: "Scrolling…" })}>Scroll down</Cmd>
            <Cmd id="enter" sending={sending} variant="ghost" onPress={() => void send({ kind: "key", key: "Enter" }, { id: "enter", words: "Pressing…" })}>Press Enter</Cmd>
            {watching && <button type="button" onClick={() => setWatching(false)} className={buttonClasses("ghost")}>Hide the course</button>}
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!text || sending) return;
              if (await send({ kind: "type", text }, { id: "type", words: "Typing…" })) setText("");
            }}
          >
            <label htmlFor="course-type" className="sr-only">Text to type</label>
            <input id="course-type" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="Tap a box, then type here" className="min-h-11 min-w-0 flex-1 basis-56 rounded-input border border-control bg-surface px-4 text-body text-ink" />
            <Cmd id="type" sending={sending} variant="quiet" submit>Type it</Cmd>
          </form>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!url || sending) return;
              if (await send({ kind: "open", url }, { id: "open", words: "Opening…" })) setUrl("");
            }}
          >
            <label htmlFor="course-url" className="sr-only">Course address</label>
            <input id="course-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" placeholder="https://your-course-address" className="min-h-11 min-w-0 flex-1 basis-56 rounded-input border border-control bg-surface px-4 text-body text-ink" />
            <Cmd id="open" sending={sending} variant="quiet" submit>Open</Cmd>
          </form>
        </Card>
      )}
    </div>
  );
}

/**
 * A Page Turner button. While any command is on its way every button refuses a press (one thing at
 * a time, so "Type it" can't type twice), and the pressed one shows a spinner and its words
 * ("Starting…"). Full strength throughout: aria-disabled, not `disabled`.
 */
function Cmd({ id, sending, variant, onPress, submit = false, disabled, children }: {
  id: string;
  sending: Sending | null;
  variant: "primary" | "quiet" | "ghost";
  onPress?: () => void;
  submit?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const mine = sending?.id === id;
  return (
    <button
      type={submit ? "submit" : "button"}
      disabled={disabled}
      aria-disabled={sending ? true : undefined}
      aria-busy={mine || undefined}
      onClick={(e) => {
        if (sending) { e.preventDefault(); return; }
        onPress?.();
      }}
      className={buttonClasses(variant, cx(sending && "cursor-progress"))}
    >
      {mine ? <><Spinner />{sending.words}</> : children}
    </button>
  );
}
