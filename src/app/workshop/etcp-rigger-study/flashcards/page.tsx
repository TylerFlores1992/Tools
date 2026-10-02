import type { Metadata } from "next";
import { PageTransition } from "@/components/PageTransition";
import { Label } from "@/components/Label";
import { CARDS } from "@/tools/etcp/cards";
import { Flashcards } from "@/tools/etcp/Flashcards";

export const metadata: Metadata = {
  title: "Flashcards · ETCP rigger study",
  description: `${CARDS.length} ETCP Certified Rigger flashcards: math and forces, hardware and safety, arena and theatre systems.`,
  alternates: { canonical: "/workshop/etcp-rigger-study/flashcards" },
  robots: { index: true, follow: true },
};

export default function FlashcardsPage() {
  return (
    <PageTransition>
      <header className="mt-8 max-w-[760px]">
        <Label>Rigging · Flashcards</Label>
        <h1 className="mt-3 text-title font-normal">Flashcards</h1>
        <p className="mt-4 text-lede text-ink-2">Read the question, say your answer, then flip. Be honest with “Got it”.</p>
      </header>
      <div className="mt-8">
        <Flashcards />
      </div>
    </PageTransition>
  );
}
