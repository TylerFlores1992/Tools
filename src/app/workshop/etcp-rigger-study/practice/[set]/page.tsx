import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { PRACTICE_SETS, practiceSet } from "@/tools/etcp/questions";
import { PracticeTest } from "@/tools/etcp/PracticeTest";

export const dynamicParams = false;

export function generateStaticParams() {
  return PRACTICE_SETS.map((s) => ({ set: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ set: string }> }): Promise<Metadata> {
  const s = practiceSet((await params).set);
  if (!s) return {};
  return {
    title: `${s.name} · ETCP rigger study`,
    description: `${s.questions.length} original ETCP Certified Rigger practice questions with the working shown for every answer.`,
    alternates: { canonical: `/workshop/etcp-rigger-study/practice/${s.slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function PracticePage({ params }: { params: Promise<{ set: string }> }) {
  const s = practiceSet((await params).set);
  if (!s) notFound();
  return (
    <PageTransition>
      <header className="mt-8 max-w-[760px]">
        <Label>Rigging · Practice</Label>
        <h1 className="mt-3 text-title font-normal">{s.name}</h1>
        <p className="mt-4 text-lede text-ink-2">
          {s.questions.length} questions in the style of the Arena exam. {s.about ? `${s.about} ` : ""}Pick an answer to lock it in and see the working.
        </p>
      </header>
      <div className="mt-8">
        <PracticeTest slug={s.slug} />
      </div>
    </PageTransition>
  );
}
