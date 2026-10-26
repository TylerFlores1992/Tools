"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow, Button, buttonClasses } from "@/components/Button";
import { answerStep } from "@/app/private/learn/actions";
import type { GradedStep } from "../types";
import { kindLabel, StepView, type Report } from "./Steps";
import { Unsaved } from "./LessonPlayer";

export type ReviewItem = { lessonId: string; lessonTitle: string; step: GradedStep };

/**
 * Today's review: items from different lessons, mixed (interleaved), each answered once. Right
 * sends an item further out; wrong brings it back tomorrow.
 */
export function ReviewPlayer({ items }: { items: readonly ReviewItem[] }) {
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [right, setRight] = useState(0);
  const [over, setOver] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const counted = useRef<Set<number>>(new Set());
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    top.current?.focus({ preventScroll: true });
    top.current?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
  }, [i, over]);

  const item = items[i];
  const report: Report = ({ correct, answer, first, recorded }) => {
    if (!first || counted.current.has(i)) return;
    counted.current.add(i);
    if (correct) setRight((n) => n + 1);
    if (recorded) return;
    answerStep({ lessonId: item.lessonId, stepId: item.step.id, correct, answer, first: true, source: "review" })
      .then((r) => !r.saved && setUnsaved(true))
      .catch(() => setUnsaved(true));
  };

  if (over || !item) {
    return (
      <div ref={top} tabIndex={-1} className="max-w-[720px] outline-none">
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <p className="font-mono text-label uppercase text-muted">Review done</p>
          <p className="mt-2 text-title font-normal tabular-nums leading-none">
            {right} <span className="text-ink-2">of {counted.current.size} right</span>
          </p>
          <p className="mt-4 text-body text-ink-2">The ones you missed come back tomorrow. The rest come back later, each time a little further out.</p>
          <Link href="/private/learn" className={buttonClasses("primary", "mt-6")}>
            Back to Learn <Arrow />
          </Link>
        </div>
        {unsaved && <Unsaved />}
      </div>
    );
  }

  return (
    <div ref={top} tabIndex={-1} className="outline-none">
      <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-bg px-5 py-3 sm:-mx-12 sm:px-12">
        <div className="flex max-w-[960px] items-center gap-4 text-small tabular-nums">
          <span className="whitespace-nowrap text-ink">{i + 1} of {items.length}</span>
          <span className="text-muted">{right} right</span>
          <div role="progressbar" aria-label="Review progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={i + 1} className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${((i + 1) / items.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-8 max-w-[960px]">
        <p className="font-mono text-label uppercase text-muted">
          {kindLabel(item.step.kind)} · from {item.lessonTitle}
        </p>
        <div className="mt-3" key={`${item.lessonId}/${item.step.id}`}>
          <StepView step={item.step} lessonId={item.lessonId} source="review" report={report} onDone={() => setAnswered(true)} />
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          {!answered && <span className="text-small text-muted">Answer to continue</span>}
          {!answered && (
            <Button variant="ghost" onClick={() => setOver(true)}>
              Stop for today
            </Button>
          )}
          <Button
            disabled={!answered}
            onClick={() => {
              setAnswered(false);
              if (i < items.length - 1) setI(i + 1);
              else setOver(true);
            }}
          >
            {i < items.length - 1 ? "Next" : "Finish"} <Arrow />
          </Button>
        </div>
        {unsaved && <Unsaved />}
      </div>
    </div>
  );
}
