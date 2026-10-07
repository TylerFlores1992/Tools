import type { Metadata } from "next";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { Arrow } from "@/components/Button";
import { SITE } from "@/lib/site";
import { toolBySlug } from "@/lib/tools";
import { PRACTICE_SETS } from "@/tools/etcp/questions";
import { CARDS, DECKS } from "@/tools/etcp/cards";
import { FORMULA_COUNT, OFFICIAL_SHEET } from "@/tools/etcp/formulas";

const tool = toolBySlug("etcp-rigger-study");
const BASE = `/workshop/${tool.slug}`;

export const metadata: Metadata = {
  title: tool.name,
  description: "Free ETCP Certified Rigger study: three practice tests (25, 25 and a 50-question exam-weighted set) with worked answers, flashcards and a formula reference.",
  alternates: { canonical: BASE },
  robots: { index: true, follow: true },
};

const SECTIONS = [
  ...PRACTICE_SETS.map((s) => ({
    href: `${BASE}/practice/${s.slug}`,
    eyebrow: `${s.questions.length} questions`,
    title: s.name,
    body: s.about ?? "Arena-style multiple choice. Tap an answer to see the working.",
  })),
  { href: `${BASE}/flashcards`, eyebrow: `${CARDS.length} cards · ${DECKS.length} decks`, title: "Flashcards", body: DECKS.map((d) => d.label).join(", ") + ". Keep what you miss in rotation." },
  { href: `${BASE}/formulas`, eyebrow: `${FORMULA_COUNT} formulas`, title: "Formula reference", body: "Bridles, beams, rope and forces, each linked to the questions that use it." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LearningResource",
  name: tool.name,
  description: metadata.description,
  url: `${SITE.url}${BASE}`,
  learningResourceType: ["Practice test", "Flashcards"],
  educationalUse: "Exam preparation",
  isAccessibleForFree: true,
};

export default function StudyOverview() {
  return (
    <PageTransition>
      <header className="mt-8 max-w-[64ch]">
        <Label>Rigging · Study</Label>
        <h1 className="mt-3 text-title font-normal">{tool.name}</h1>
        <p className="mt-4 text-lede text-ink-2">
          Practice for the ETCP Certified Rigger exams. Every question is original and comes with the working shown, and your progress stays in this browser.
        </p>
      </header>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-control hover:bg-surface-2 sm:p-6">
              <span className="font-mono text-label uppercase text-muted">{s.eyebrow}</span>
              <span className="mt-3 flex items-center justify-between gap-4 text-h3 font-medium text-ink">
                {s.title}
                <Arrow className="shrink-0 text-muted transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-ember" />
              </span>
              <span className="mt-2 text-body text-ink-2">{s.body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <aside className="mt-10 max-w-[72ch] border-t border-line pt-5 text-small text-muted">
        <p>
          Unofficial study material, not affiliated with ESTA or ETCP. Questions are written to the published{" "}
          <a className="text-ink-2 underline underline-offset-2 hover:text-ink" href="https://etcp.esta.org/certify/examination_rigger_arena.html">Arena</a> and{" "}
          <a className="text-ink-2 underline underline-offset-2 hover:text-ink" href="https://etcp.esta.org/certify/examination_rigger_theatre.html">Theatre</a> content outlines. In the exam you get ETCP&apos;s own{" "}
          <a className="text-ink-2 underline underline-offset-2 hover:text-ink" href={OFFICIAL_SHEET.url}>formula sheet (PDF)</a>. Check every real-world calculation against manufacturer data and a qualified rigger.
        </p>
      </aside>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </PageTransition>
  );
}
