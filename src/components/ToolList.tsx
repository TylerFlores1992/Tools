import Link from "next/link";
import { toolHref, type Tool } from "@/lib/tools";
import { cx } from "./cx";

function Status({ t }: { t: Tool }) {
  if (t.status === "building") return <span className="inline-flex items-center gap-2 text-muted"><span aria-hidden="true">◌</span> Building</span>;
  if (t.tier === 3) return <span className="inline-flex items-center gap-2 text-ink-2"><span aria-hidden="true">↗</span> Own site</span>;
  return <span className="inline-flex items-center gap-2 text-ice"><span aria-hidden="true">●</span> Live</span>;
}

/**
 * The workshop's tools as rows: name (a heading, so screen readers can jump between tools),
 * summary, kind and status. Below `lg` kind and status share one line under the summary; from
 * `lg` they get their own columns. The hover fill has padding, so nothing touches its edge.
 */
export function ToolList({ tools, heading: H = "h2" }: { tools: readonly Tool[]; heading?: "h2" | "h3" }) {
  return (
    <ol className="divide-y divide-line">
      {tools.map((t, i) => {
        const inner = (
          <>
            <span className="hidden font-mono text-label text-muted lg:block">{String(i + 1).padStart(3, "0")}</span>
            <span>
              <H className="text-h3 font-medium tracking-[-0.015em] text-ink">{t.name}</H>
              <span className="mt-1.5 block max-w-[52ch] text-ink-2">{t.summary}</span>
            </span>
            <span className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-label uppercase lg:contents">
              <span className="text-muted">{t.kind}</span>
              <Status t={t} />
            </span>
            <span aria-hidden="true" className="hidden text-h3 text-muted transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-ember lg:block">
              {t.status === "building" ? "" : t.tier === 3 ? "↗" : "→"}
            </span>
          </>
        );
        const cls = "group -mx-4 grid gap-x-8 gap-y-3 rounded-card px-4 py-7 lg:grid-cols-[56px_minmax(0,1fr)_200px_140px_24px] lg:items-baseline";
        if (t.status === "building") return <li key={t.slug} className={cls}>{inner}</li>;
        const href = toolHref(t);
        const link = cx(cls, "transition-colors duration-150 hover:bg-surface/60");
        return (
          <li key={t.slug}>
            {t.tier === 3 ? <a href={href} className={link}>{inner}</a> : <Link href={href} className={link}>{inner}</Link>}
          </li>
        );
      })}
    </ol>
  );
}
