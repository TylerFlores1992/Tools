import Link from "next/link";
import { toolHref, type Tool } from "@/lib/tools";
import { cx } from "./cx";
import { LinkPending } from "./LinkPending";
import { PRESS_FILL, PRESS_ROW } from "./press";

function Status({ t }: { t: Tool }) {
  if (t.status === "building") return <span className="inline-flex items-center gap-2 text-muted"><span aria-hidden="true">◌</span> Building</span>;
  if (t.tier === 3) return <span className="inline-flex items-center gap-2 text-ink-2"><span aria-hidden="true">↗</span> Own site</span>;
  return <span className="inline-flex items-center gap-2 text-ice"><span aria-hidden="true">●</span> Live</span>;
}

/** The arrow-out-of-a-box mark for a link that leaves this site. */
function External() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="ml-2 inline-block shrink-0 align-baseline text-muted">
      <path d="M9 3h4v4M13 3L7 9M11 9.5V13H3V5h3.5" />
    </svg>
  );
}

/**
 * The workshop's tools as rows: name (a heading, so screen readers can jump between tools),
 * summary, kind and status. Below `lg` kind and status share one line under the summary; from
 * `lg` they get their own columns. The hover fill has padding, so nothing touches its edge.
 *
 * Each row link is named by the tool's name (plus where it goes, for one on its own site) and
 * described by its summary, so a screen reader hears a short name rather than the whole row.
 * A tool on its own site opens in the same tab, like every other link on this site; the ↗ mark
 * and "(opens camphawk.app)" say it leaves before you tap.
 */
export function ToolList({ tools, heading: H = "h2" }: { tools: readonly Tool[]; heading?: "h2" | "h3" }) {
  return (
    <ol className="divide-y divide-line">
      {tools.map((t, i) => {
        const href = toolHref(t);
        const external = t.tier === 3;
        const live = t.status !== "building";
        const nameId = `tool-${t.slug}-name`, sumId = `tool-${t.slug}-summary`;
        const inner = (
          <>
            <span className="hidden font-mono text-label text-muted lg:block">{String(i + 1).padStart(3, "0")}</span>
            <span>
              <H id={nameId} className="text-h3 font-medium tracking-[-0.015em] text-ink">
                {t.name}
                {live && external && (
                  <>
                    <External />
                    <span className="sr-only"> (opens {new URL(href).host})</span>
                  </>
                )}
                {/* Pulses beside the name while the tool's page is still loading. */}
                {live && !external && <LinkPending className="ml-2 align-middle" />}
              </H>
              <span id={sumId} className="mt-1.5 block max-w-[52ch] text-ink-2">{t.summary}</span>
            </span>
            <span className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-label uppercase lg:contents">
              <span className="text-muted">{t.kind}</span>
              <Status t={t} />
            </span>
            <span aria-hidden="true" className="hidden text-h3 text-muted transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-ember lg:block">
              {!live ? "" : external ? "↗" : "→"}
            </span>
          </>
        );
        const cls = "group -mx-4 grid gap-x-8 gap-y-3 rounded-card px-4 py-7 lg:grid-cols-[56px_minmax(0,1fr)_200px_140px_24px] lg:items-baseline";
        if (!live) return <li key={t.slug} className={cls}>{inner}</li>;
        const link = cx(cls, "transition-[background-color,scale] duration-150 hover:bg-surface/60", PRESS_FILL, PRESS_ROW);
        const named = { "aria-labelledby": nameId, "aria-describedby": sumId };
        return (
          <li key={t.slug}>
            {external ? <a href={href} className={link} {...named}>{inner}</a> : <Link href={href} className={link} {...named}>{inner}</Link>}
          </li>
        );
      })}
    </ol>
  );
}
