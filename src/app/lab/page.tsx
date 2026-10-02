import type { Metadata } from "next";
import { COLOR_TOKENS } from "@/design/tokens";
import { Button, LinkButton, Arrow } from "@/components/Button";
import { State } from "@/components/State";
import { Kbd } from "@/components/Kbd";

// The design system on one page, for screenshots and eyeballing. Not linked, not indexed.
export const metadata: Metadata = { title: "Lab", robots: { index: false, follow: false } };

const TYPE = [
  ["text-display", "Quiet tools."],
  ["text-title", "Two-leg bridle"],
  ["text-h2", "Leg tensions"],
  ["text-h3", "Left leg"],
  ["text-lede", "Drag the bridle point and read the tensions as you go."],
  ["text-body", "Tensions are static and ignore the weight of the legs and hardware. Check real rigs against your references."],
  ["text-small", "Updated September 2026"],
] as const;

export default function Lab() {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-5 py-20 sm:px-12">
      <p className="font-mono text-label uppercase text-muted">Lab</p>
      <h1 className="mt-3 text-title font-normal">Design system</h1>

      <h2 className="mt-16 text-h2 font-normal">Color tokens</h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COLOR_TOKENS.map((t) => (
          <li key={t.name} className="flex gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
            <span aria-hidden="true" className="size-12 shrink-0 rounded-tag border border-line-2" style={{ background: `var(--fw-${t.name})` }} />
            <span>
              <span className="block font-mono text-small text-ink">{t.name}</span>
              <span className="block text-small text-ink-2">{t.meaning}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-16 text-h2 font-normal">Type</h2>
      <div className="mt-6 space-y-6">
        {TYPE.map(([cls, sample]) => (
          <div key={cls} className="border-t border-line pt-4">
            <p className="font-mono text-label uppercase text-muted">{cls}</p>
            <p className={`${cls} mt-2 max-w-[72ch]`}>{sample}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-h2 font-normal">States</h2>
      <p className="mt-2 text-small text-muted">Always icon + word + colour. Never colour alone.</p>
      <div className="mt-6 grid gap-3">
        <State kind="ok">Both legs carry less than the load.</State>
        <State kind="wrong">Keep the bridle point between the two beams.</State>
        <State kind="note">Legs are 104° apart. Past 120°, each leg carries more than the load.</State>
      </div>

      <h2 className="mt-16 text-h2 font-normal">Actions</h2>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <LinkButton href="/workshop" className="group">Enter the workshop <Arrow /></LinkButton>
        <Button variant="quiet">Quiet</Button>
        <Button variant="ghost">Ghost</Button>
        <Button disabled>Disabled</Button>
        <span className="text-small text-ink-2">Press <Kbd>⌘K</Kbd></span>
      </div>
      <div className="mt-6">
        <input aria-label="Example input" placeholder="Span (ft)" className="min-h-12 rounded-input border border-control bg-surface px-4 text-ink placeholder:text-muted" />
      </div>
    </main>
  );
}
