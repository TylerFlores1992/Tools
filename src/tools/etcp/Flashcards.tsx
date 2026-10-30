"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { State } from "@/components/State";
import { cx } from "@/components/cx";
import { CARDS, DECKS, type Deck } from "./cards";
import { RichText } from "./Rich";
import { useStored } from "./stored";

type Filter = "all" | Deck;
const NONE: string[] = [];
const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const DEFAULT_ORDER = CARDS.map((c) => c.id);
const byId = new Map(CARDS.map((c) => [c.id, c]));
const deckOf = (id: string) => byId.get(id)!.deck;

export function Flashcards() {
  const [knownList, setKnownList] = useStored("etcp:cards:known", NONE, isIds);
  const known = new Set(knownList);
  const [filter, setFilter] = useState<Filter>("all");
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [pos, setPos] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);

  const inFilter = (id: string) => filter === "all" || deckOf(id) === filter;
  const pile = order.filter((id) => inFilter(id) && !known.has(id));
  const total = CARDS.filter((c) => inFilter(c.id)).length;
  const learned = total - pile.length;
  const idx = pile.length ? Math.min(pos, pile.length - 1) : 0;
  const current = pile.length ? byId.get(pile[idx])! : null;
  const flipped = current !== null && flippedId === current.id;
  const deck = current ? DECKS.find((d) => d.key === current.deck)! : null;

  const go = (delta: number) => {
    if (!pile.length) return;
    setPos((idx + delta + pile.length) % pile.length);
    setFlippedId(null);
  };
  // A button that's pressed swaps for another (Show answer → Again / Got it), so focus moves on
  // with it: to the answer after a flip, to "Show answer" after rating a card.
  const answerRef = useRef<HTMLDivElement>(null);
  const showRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"answer" | "show" | null>(null);
  useEffect(() => {
    const target = focusNext.current === "answer" ? answerRef.current : focusNext.current === "show" ? showRef.current : null;
    focusNext.current = null;
    target?.focus();
  });

  const flip = () => current && setFlippedId(flipped ? null : current.id);
  function gotIt() {
    if (!current || !flipped) return;
    setKnownList([...knownList, current.id]);
    setFlippedId(null);
    // The next card slides into this position; wrap at the end.
    if (idx >= pile.length - 1) setPos(0);
  }
  function again() {
    if (!current || !flipped) return;
    // Bring it back three cards from now.
    const target = pile[Math.min(idx + 3, pile.length - 1)];
    const rest = order.filter((id) => id !== current.id);
    rest.splice(rest.indexOf(target) + 1, 0, current.id);
    setOrder(rest);
    setFlippedId(null);
    if (idx >= pile.length - 1) setPos(0);
  }
  function shuffle() {
    const a = [...DEFAULT_ORDER];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    setOrder(a);
    setPos(0);
    setFlippedId(null);
  }
  function resetDeck() {
    setKnownList(knownList.filter((id) => !inFilter(id)));
    setPos(0);
    setFlippedId(null);
  }

  // Keys work anywhere on the page, except while typing or using a control's own keys:
  // ← → move, F (or Space/Enter away from a button or link) flips, A is Again, G is Got it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role=radiogroup], [role=slider]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const onControl = !!t.closest("button, a, summary, [role=button]");
      const k = e.key.toLowerCase();
      if (k === "arrowright") go(1);
      else if (k === "arrowleft") go(-1);
      else if (k === "f" || ((k === " " || k === "enter") && !onControl)) {
        if (!current) return;
        e.preventDefault();
        focusNext.current = flipped ? "show" : "answer";
        flip();
      } else if (k === "a" && flipped) { focusNext.current = "show"; again(); }
      else if (k === "g" && flipped) { focusNext.current = "show"; gotIt(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="max-w-[760px]">
      {/* relative: keeps each chip's sr-only text inside the scroller, so the page can't scroll sideways */}
      <div role="group" aria-label="Deck" className="relative -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {([{ key: "all", label: "All cards", glyph: "" }, ...DECKS] as const).map((d) => {
          const on = filter === d.key;
          const left = CARDS.filter((c) => (d.key === "all" || c.deck === d.key) && !known.has(c.id)).length;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => { setFilter(d.key); setPos(0); setFlippedId(null); }}
              className={cx(
                "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-small transition-colors duration-150",
                on ? "border-primary bg-primary text-on-primary" : "border-line-2 bg-surface text-ink-2 hover:border-control hover:text-ink",
              )}
            >
              {on && <span aria-hidden="true">✓</span>}
              {d.glyph && <span aria-hidden="true">{d.glyph}</span>}
              {d.label}
              <span className="tabular-nums">{left}</span>
              <span className="sr-only">left</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-small tabular-nums">
        <span className="text-ink">{learned} of {total} learned</span>
        <div role="progressbar" aria-label="Learned" aria-valuemin={0} aria-valuemax={total} aria-valuenow={learned} className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${total ? (learned / total) * 100 : 0}%` }} />
        </div>
        <span className="-mx-3 flex gap-1">
          <Button variant="ghost" className="min-h-11 px-3 text-small" onClick={shuffle}>Shuffle</Button>
          <Button variant="ghost" className="min-h-11 px-3 text-small" onClick={resetDeck} disabled={learned === 0}>Reset deck</Button>
        </span>
      </div>

      {current && deck ? (
        <>
          <section aria-label="Flashcard" className="mt-4 rounded-card border border-line bg-surface shadow-card">
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 font-mono text-label uppercase text-muted sm:px-6">
              <span className="whitespace-nowrap"><span aria-hidden="true" className="mr-2">{deck.glyph}</span>{deck.label}</span>
              {/* The one live line: says which card and side, not the whole card. */}
              <span aria-live="polite" aria-atomic="true" className="whitespace-nowrap tabular-nums">
                {flipped ? "Answer · " : ""}<span className="sr-only">Card </span>{idx + 1}<span aria-hidden="true"> / </span><span className="sr-only"> of </span>{pile.length}
              </span>
            </div>
            <div ref={answerRef} tabIndex={-1} onClick={flip} className="flip-in min-h-52 cursor-pointer px-5 py-7 outline-none sm:px-8 sm:py-8" key={`${current.id}-${flipped}`}>
              {flipped ? (
                <>
                  <p className="text-small text-muted">{current.q}</p>
                  <RichText text={current.a} className="mt-4 text-body text-ink-2" />
                </>
              ) : (
                <p className="text-h2 font-normal text-ink">{current.q}</p>
              )}
            </div>
            {flipped && (
              <div className="border-t border-line p-2">
                <Button variant="ghost" className="w-full" onClick={() => { focusNext.current = "show"; flip(); }}>Show question</Button>
              </div>
            )}
          </section>

          {/* One action slot right under the card: "Show answer" until it's flipped, then rate it.
              Not sticky: on a phone a stuck bar sat over the question itself. */}
          <div className="mt-4">
            {flipped ? (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="quiet" onClick={() => { focusNext.current = "show"; again(); }}>Again</Button>
                <Button onClick={() => { focusNext.current = "show"; gotIt(); }}><span aria-hidden="true">✓</span> Got it</Button>
              </div>
            ) : (
              <Button ref={showRef} className="w-full" onClick={() => { focusNext.current = "answer"; flip(); }}>Show answer</Button>
            )}
          </div>
          <div className="-mx-5 mt-3 flex justify-between">
            <Button variant="ghost" onClick={() => go(-1)}><span aria-hidden="true">←</span> Previous</Button>
            <Button variant="ghost" onClick={() => go(1)}>Next <span aria-hidden="true">→</span></Button>
          </div>
          <p className="mt-4 hidden text-small text-muted sm:block">Tip: F or Space flips the card, A is Again, G is Got it, and ← → move between cards.</p>
        </>
      ) : (
        <div className="mt-4 rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
          <State kind="ok" className="text-h3">Deck clear</State>
          <p className="mt-3 text-body text-ink-2">Every card here is marked learned. Pick another deck, or reset this one to go again.</p>
          <Button variant="quiet" className="mt-5" onClick={resetDeck}>Reset deck</Button>
        </div>
      )}
      <p className="mt-8 text-small text-muted">“Got it” takes a card out of the pile; “Again” brings it back three cards later. Progress is saved in this browser only.</p>
    </div>
  );
}
