"use client";

import { useActionState, useRef, useState } from "react";
import { Arrow, Button } from "@/components/Button";
import { State } from "@/components/State";
import { newCalendarScript, uploadDocument, type ScriptState, type UploadState } from "@/app/private/money/income/actions";

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
