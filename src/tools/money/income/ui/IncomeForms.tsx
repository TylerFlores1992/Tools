"use client";

import { useActionState, useRef, useState } from "react";
import { Arrow, Button } from "@/components/Button";
import { State } from "@/components/State";
import Link from "next/link";
import { newCalendarScript, uploadDocument, uploadOne, type OneResult, type ScriptState, type UploadState } from "@/app/private/money/income/actions";

/**
 * Photo or PDF of a stub or W-2. Big photos are shrunk in the browser first (long side 2200 px,
 * JPEG), which also turns an iPhone HEIC into a JPEG the model can read, and keeps the upload
 * under the 4 MB limit. Works without JavaScript too: the file is then sent as it is.
 */
const MAX_SIDE = 2200;

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || (file.size < 1_200_000 && file.type === "image/jpeg")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function UploadForm({ kind: initialKind }: { kind: "stub" | "w2" }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadDocument, { attempt: 0 });
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="text-small text-ink-2">What is it?</legend>
        <div className="flex flex-wrap gap-3">
          {(["stub", "w2"] as const).map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2 rounded-btn border border-line-2 bg-surface px-4 text-body text-ink has-[:checked]:border-ink">
              <input type="radio" name="kind" value={k} defaultChecked={k === initialKind} className="size-5 accent-ink" />
              {k === "stub" ? "Pay stub" : "W-2"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-2">
        <span className="text-small text-ink-2">Photo or PDF</span>
        <input
          ref={input}
          type="file"
          name="file"
          required
          accept="image/*,application/pdf"
          className="w-full min-w-0 text-small text-ink-2 file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-line-2 file:bg-surface-2 file:px-4 file:text-small file:text-ink"
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            setBusy(true);
            const small = await shrink(f);
            if (small !== f && input.current) {
              const dt = new DataTransfer();
              dt.items.add(small);
              input.current.files = dt.files;
            }
            setName(`${small.name} · ${(small.size / 1_000_000).toFixed(1)} MB`);
            setBusy(false);
          }}
        />
        {name && <span className="text-small text-muted">{name}</span>}
      </label>
      <p className="text-small text-muted">Lay it flat, fill the frame, avoid glare. The photo goes to an AI model to be read; you check every number before anything is saved.</p>
      <p aria-live="polite" className="min-h-6 text-small">
        {state.error && <State kind="wrong">{state.error}</State>}
        {pending && <State kind="note">Reading it… this usually takes 10 to 30 seconds.</State>}
      </p>
      <Button type="submit" disabled={pending || busy} className="w-full sm:w-auto sm:justify-self-start">
        {pending ? "Reading…" : busy ? "Preparing photo…" : <>Read it <Arrow /></>}
      </Button>
    </form>
  );
}

type Row = { name: string; state: "waiting" | "reading" | "done" | "failed" | "skipped" | "error"; text?: string; id?: string };

const ROW_WORD: Record<Row["state"], string> = {
  waiting: "Waiting", reading: "Reading…", done: "Read · check it", failed: "Couldn’t read · enter by hand", skipped: "Already added", error: "Not added",
};

/**
 * A year of stubs at once: PDFs downloaded from the payroll sites, or a stack of photos. Files go
 * one at a time (each read takes 5 to 30 seconds), so the page has to stay open until it's done.
 * Every one lands in "Waiting for you to check"; nothing counts until it's saved.
 */
export function BulkUploadForm() {
  const [kind, setKind] = useState<"stub" | "w2">("stub");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);
  const files = useRef<File[]>([]);
  const set = (i: number, r: Partial<Row>) => setRows((all) => all.map((x, j) => (j === i ? { ...x, ...r } : x)));

  async function run() {
    stop.current = false;
    setRunning(true);
    for (let i = 0; i < files.current.length; i++) {
      if (stop.current) break;
      if (rows[i] && rows[i].state !== "waiting") continue;
      set(i, { state: "reading" });
      try {
        const f = await shrink(files.current[i]);
        const form = new FormData();
        form.set("kind", kind);
        form.set("file", f);
        const res: OneResult = await uploadOne(form);
        if (res.ok) set(i, { state: res.status === "failed" ? "failed" : "done", text: res.label, id: res.id });
        else if (res.error === "Already added.") set(i, { state: "skipped", id: res.id });
        else set(i, { state: "error", text: res.error });
      } catch {
        set(i, { state: "error", text: "The upload didn’t go through. Try this one again on its own." });
      }
    }
    setRunning(false);
  }

  const done = rows.filter((r) => r.state !== "waiting" && r.state !== "reading").length;
  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2" disabled={running}>
        <legend className="text-small text-ink-2">What are they?</legend>
        <div className="flex flex-wrap gap-3">
          {(["stub", "w2"] as const).map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2 rounded-btn border border-line-2 bg-surface px-4 text-body text-ink has-[:checked]:border-ink">
              <input type="radio" name="bulk-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="size-5 accent-ink" />
              {k === "stub" ? "Pay stubs" : "W-2s"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-2">
        <span className="text-small text-ink-2">Photos or PDFs, as many as you like</span>
        <input
          type="file"
          multiple
          disabled={running}
          accept="image/*,application/pdf"
          className="w-full min-w-0 text-small text-ink-2 file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-line-2 file:bg-surface-2 file:px-4 file:text-small file:text-ink"
          onChange={(e) => {
            files.current = [...(e.currentTarget.files ?? [])];
            setRows(files.current.map((f) => ({ name: f.name, state: "waiting" })));
          }}
        />
      </label>
      <p className="text-small text-muted">One stub per file. They&rsquo;re read one at a time, about 5 to 30 seconds each, so keep this page open until the list is done. A file you already added is skipped.</p>
      {rows.length > 0 && (
        <>
          <p aria-live="polite" className="text-small text-ink-2">{running ? `Reading ${Math.min(done + 1, rows.length)} of ${rows.length}…` : done ? `${done} of ${rows.length} done.` : `${rows.length} ${rows.length === 1 ? "file" : "files"} ready.`}</p>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 truncate text-small text-ink">{r.name}{r.text ? <span className="text-muted"> · {r.text}</span> : null}</span>
                {r.id ? (
                  <Link href={`/private/money/income/stubs/${r.id}`} className="shrink-0 text-small text-ink underline underline-offset-4">{ROW_WORD[r.state]}</Link>
                ) : (
                  <span className="shrink-0 text-small text-ink-2">{ROW_WORD[r.state]}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        {running ? (
          <Button type="button" variant="quiet" onClick={() => { stop.current = true; }}>Stop after this one</Button>
        ) : (
          <Button type="button" disabled={!rows.some((r) => r.state === "waiting")} onClick={run}>
            {done ? "Carry on" : <>Read them all <Arrow /></>}
          </Button>
        )}
        {!running && done > 0 && <Link href="/private/money/income" className="inline-flex min-h-11 items-center text-body text-ink underline underline-offset-4">Check them on Income</Link>}
      </div>
    </div>
  );
}

export function CalendarScriptForm({ connected }: { connected: boolean }) {
  const [state, action, pending] = useActionState<ScriptState, FormData>(newCalendarScript, { attempt: 0 });
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-4">
      <form action={action}>
        <Button type="submit" variant={connected ? "quiet" : "primary"} disabled={pending}>
          {pending ? "Making…" : connected ? "Make a new script (replaces the old one)" : <>Make my calendar script <Arrow /></>}
        </Button>
      </form>
      {state.script && (
        <div className="grid gap-3">
          <ol className="grid list-decimal gap-1.5 pl-5 text-body text-ink-2 marker:text-muted">
            <li>Open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">a new Apps Script project</a> while signed in to the Google account with your work calendar.</li>
            <li>Delete what&rsquo;s there and paste the script below.</li>
            <li>Choose <span className="text-ink">setup</span> in the function menu, press Run, and allow access to Calendar.</li>
          </ol>
          <textarea readOnly value={state.script} rows={8} aria-label="Calendar script" className="field w-full rounded-input border border-control bg-surface p-3 font-mono text-small text-ink" />
          <Button
            type="button"
            variant="quiet"
            className="justify-self-start"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.script ?? "");
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "✓ Copied" : "Copy script"}
          </Button>
          <p className="text-small text-muted">The key inside is shown only now. If you lose it, make a new script.</p>
        </div>
      )}
    </div>
  );
}
