import type { Metadata } from "next";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { Arrow } from "@/components/Button";
import { CONVERSIONS, FORMULA_GROUPS, OFFICIAL_SHEET, type Formula } from "@/tools/etcp/formulas";
import { RichLine, RichText } from "@/tools/etcp/Rich";

export const metadata: Metadata = {
  title: "Formula reference · ETCP rigger study",
  description: "Rigging formulas for the ETCP Certified Rigger exams: bridles, beam reactions, design factor, shock loads and conversions, each linked to a worked practice question.",
  alternates: { canonical: "/workshop/etcp-rigger-study/formulas" },
  robots: { index: true, follow: true },
};

/** "a03" → link to question 3 of test A. */
function QuestionLink({ id }: { id: string }) {
  const set = id[0], n = Number(id.slice(1));
  return (
    <Link href={`/workshop/etcp-rigger-study/practice/${set}#${id}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-tag border border-line-2 px-2.5 font-mono text-label text-ink-2 hover:border-control hover:text-ink">
      {set.toUpperCase()}{n}
    </Link>
  );
}

function FormulaRow({ f }: { f: Formula }) {
  return (
    <li className="border-t border-line py-6 first:border-t-0">
      <h3 className="text-h3 font-medium text-ink">{f.name}</h3>
      <div className="mt-3 overflow-x-auto rounded-input border border-line bg-surface-2 px-4 py-3 text-lede tabular-nums text-ink">
        {f.expr.split("\n").map((line, i) => (
          <p key={i} className="whitespace-nowrap"><RichLine text={line} /></p>
        ))}
      </div>
      {f.where && <RichText text={f.where} className="mt-3 text-small text-ink-2" />}
      {f.note && <RichText text={f.note} className="mt-1 text-small text-muted" />}
      {f.questions && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-small text-muted">
          Practice:
          {f.questions.map((q) => <QuestionLink key={q} id={q} />)}
        </p>
      )}
    </li>
  );
}

export default function FormulasPage() {
  return (
    <PageTransition>
      <header className="mt-8 max-w-[760px]">
        <Label>Rigging · Reference</Label>
        <h1 className="mt-3 text-title font-normal">Formula reference</h1>
        <p className="mt-4 text-lede text-ink-2">The formulas behind the practice questions, written the way the worked answers use them.</p>
      </header>

      <div className="mt-8 max-w-[760px]">
        <a href={OFFICIAL_SHEET.url} className="group flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-control hover:bg-surface-2">
          <span>
            <span className="block font-mono text-label uppercase text-muted">In the exam · PDF</span>
            <span className="mt-1 block text-body font-medium text-ink">{OFFICIAL_SHEET.title}</span>
            <span className="mt-1 block text-small text-ink-2">ETCP hands you its own sheet in the exam. Learn its notation too; this page is a study companion, not a copy.</span>
          </span>
          <Arrow className="shrink-0 text-muted transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-ember" />
        </a>

        <nav aria-label="Formula groups" className="mt-8 flex flex-wrap gap-2">
          {FORMULA_GROUPS.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="flex min-h-11 items-center rounded-full border border-line-2 bg-surface px-4 text-small text-ink-2 hover:border-control hover:text-ink">{g.title}</a>
          ))}
          <a href="#conversions" className="flex min-h-11 items-center rounded-full border border-line-2 bg-surface px-4 text-small text-ink-2 hover:border-control hover:text-ink">Conversions</a>
        </nav>

        {FORMULA_GROUPS.map((g) => (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="mt-12 scroll-mt-6">
            <h2 id={`${g.id}-h`} className="border-b border-line-2 pb-3 text-h2 font-normal">{g.title}</h2>
            <ul>{g.formulas.map((f) => <FormulaRow key={f.id} f={f} />)}</ul>
          </section>
        ))}

        <section id="conversions" aria-labelledby="conversions-h" className="mt-12 scroll-mt-6">
          <h2 id="conversions-h" className="border-b border-line-2 pb-3 text-h2 font-normal">Conversions</h2>
          <p className="mt-4 text-small text-muted">Not on the official sheet. Know these from memory.</p>
          <table className="mt-4 w-full text-body tabular-nums">
            <tbody>
              {CONVERSIONS.map(([a, b]) => (
                <tr key={a} className="border-b border-line">
                  <th scope="row" className="py-3 pr-6 text-left font-medium text-ink">{a}</th>
                  <td className="py-3 text-ink-2">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </PageTransition>
  );
}
