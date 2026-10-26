import type { ReactNode } from "react";
import { cx } from "@/components/cx";

/**
 * Code as you'd read it in a review: line numbers, monospace, no colour coding (the owner is
 * red-green colour-blind, and weight + tone carry it better): keywords bold, strings softer,
 * comments muted and italic.
 */

const KEYWORDS = new Set(
  "const let var function return if else for while of in new true false null undefined typeof async await class extends import export from type interface break continue switch case default try catch throw".split(" "),
);
const TOKEN = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

export function tokens(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    const [t, comment, str, num, word] = m;
    if (comment) out.push(<span key={k++} className="italic text-muted">{t}</span>);
    else if (str) out.push(<span key={k++} className="text-ink-2">{t}</span>);
    else if (num) out.push(<span key={k++} className="text-ink">{t}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={k++} className="font-semibold text-ink">{t}</span>);
    else out.push(t);
    last = i + t.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeBlock({ code, label, className, notes }: { code: string; label?: string; className?: string; notes?: readonly { from: number; to: number; text: string }[] }) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <figure className={cx("overflow-hidden rounded-input border border-line bg-surface-2", className)}>
      {label && <figcaption className="border-b border-line px-4 py-2 font-mono text-label uppercase text-muted">{label}</figcaption>}
      <pre className="overflow-x-auto py-3 font-mono text-small leading-relaxed text-ink-2" tabIndex={0} aria-label={label ?? "Code"}>
        <code>
          {lines.map((l, i) => {
            const note = notes?.find((n) => n.from === i + 1);
            return (
              <span key={i} className="block">
                {note && (
                  <span className="mb-1 mt-2 block px-4 font-sans text-small not-italic text-ink first:mt-0">
                    <span aria-hidden="true" className="mr-2 font-mono text-label text-muted">▸</span>
                    {note.text}
                  </span>
                )}
                <span className="inline-block w-10 select-none pr-3 text-right tabular-nums text-muted" aria-hidden="true">{i + 1}</span>
                <span className="pr-4">{tokens(l)}</span>
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
}

/** `inline code` in backticks inside lesson prose; blank lines start a new paragraph. */
export function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx("grid gap-3 text-body text-ink-2", className)}>
      {text.split(/\n\s*\n/).map((para, i) => (
        <p key={i}>{inline(para)}</p>
      ))}
    </div>
  );
}

export function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
      return (
        <code key={i} className="rounded-[6px] border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    return part;
  });
}
