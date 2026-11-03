"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import { State } from "@/components/State";
import { cx } from "@/components/cx";
import { PRESS, PRESS_FILL } from "@/components/press";
import { CARDS, DECKS, type Deck } from "./cards";
import { againMove } from "./deck";
import { RichText } from "./Rich";
import { useStored } from "./stored";

type Filter = "all" | Deck;
const NONE: string[] = [];
const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const DEFAULT_ORDER = CARDS.map((c) => c.id);
const byId = new Map(CARDS.map((c) => [c.id, c]));
const deckOf = (id: string) => byId.get(id)!.deck;
const noSubscribe = () => () => {};

export function Flashcards() {
  const [knownList, setKnownList] = useStored("etcp:cards:known", NONE, isIds);
  const known = new Set(knownList);
  const [filter, setFilter] = useState<Filter>("all");
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [pos, setPos] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  // Saved progress lives in this browser, so the server (and first client) render can't know the
  // counts. Until it's read they show a muted dash rather than numbers that jump a moment later.
  const loaded = useSyncExternalStore(noSubscribe, () => true, () => false);
  // A short spoken and visible confirmation after Shuffle or Reset (cleared after a moment).
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const inFilter = (id: string) => filter === "all" || deckOf(id) === filter;
  const pile = order.filter((id) => inFilter(id) && !known.has(id));
  const total = CARDS.filter((c) => inFilter(c.id)).length;
  const learned = total - pile.length;
  const idx = pile.length ? Math.min(pos, pile.length - 1) : 0;
  const current = pile.length ? byId.get(pile[idx])! : null;
  const flipped = current !== null && flippedId === current.id;
  const deck = current ? DECKS.find((d) => d.key === current.deck)! : null;

  const go = (delta: number) => {
    if (pile.length <= 1) return;
    setPos((idx + delta + pile.length) % pile.length);
    setFlippedId(null);
  };
  // A button that's pressed swaps for another (Show answer → Again / Got it), so focus moves on
  // with it: to the answer after a flip, to "Show answer" after rating a card.
  // When the deck clears, focus goes to its heading; after Reset, back to "Show answer".
  const answerRef = useRef<HTMLDivElement>(null);
  const showRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<"answer" | "show" | "reset" | null>(null);
  useEffect(() => {
    const want = focusNext.current;
    if (!want) return;
    // "show" lands on the deck-clear heading when the last card was just learned; "reset" waits
    // for the render where the cards are back, so focus never drops to the page.
    const target = want === "answer" ? answerRef.current : want === "show" ? showRef.current ?? clearRef.current : showRef.current;
    if (!target) return;
    focusNext.current = null;
    target.focus();
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
    // Bring it back three cards from now (or at the end), and show the card behind it.
    const next = againMove(order, pile, idx);
    setOrder(next.order);
    setPos(next.pos);
    setFlippedId(null);
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
    setNotice("Shuffled. Starting from a new first card.");
  }
  function resetDeck() {
    const name = filter === "all" ? "all cards" : `the ${DECKS.find((d) => d.key === filter)!.label} deck`;
    if (!window.confirm(`Reset ${name}? The ${learned} ${learned === 1 ? "card" : "cards"} you marked learned go back in the pile.`)) return;
    setKnownList(knownList.filter((id) => !inFilter(id)));
    setPos(0);
    setFlippedId(null);
    setNotice("Deck reset. Every card is back in the pile.");
    focusNext.current = "reset";
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
                "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-small transition-[color,background-color,border-color,scale] duration-150",
                PRESS,
                on ? "border-primary bg-primary text-on-primary" : cx("border-line-2 bg-surface text-ink-2 hover:border-control hover:text-ink", PRESS_FILL),
              )}
            >
              {on && <span aria-hidden="true">✓</span>}
              {d.glyph && <span aria-hidden="true">{d.glyph}</span>}
              {d.label}
              {loaded ? (
                <><span className="tabular-nums">{left}</span><span className="sr-only">left</span></>
              ) : (
                <span aria-hidden="true" className={on ? undefined : "text-muted"}>–</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-small tabular-nums">
        {loaded ? (
          <span className="text-ink">{learned} of {total} learned</span>
        ) : (
          <span className="text-muted"><span aria-hidden="true">–</span><span className="sr-only">Loading your progress,</span> of {total} learned</span>
        )}
        <div role="progressbar" aria-label="Learned" aria-valuemin={0} aria-valuemax={total} aria-valuenow={loaded ? learned : undefined} aria-valuetext={loaded ? `${learned} of ${total} learned` : "Loading"} className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${loaded && total ? (learned / total) * 100 : 0}%` }} />
        </div>
        <span className="-mx-3 flex gap-1">
          <Button variant="ghost" className="min-h-11 px-3 text-small" onClick={shuffle}>Shuffle</Button>
          <Button variant="ghost" className="min-h-11 px-3 text-small" onClick={resetDeck} disabled={!loaded || learned === 0}>Reset deck</Button>
        </span>
      </div>
      {/* Always rendered so screen readers hear it; visible too, so a tap on Shuffle is seen to land. */}
      <p role="status" className="mt-1 min-h-6 text-small text-ink-2">
        {notice && <State kind="ok" sr={false}>{notice}</State>}
      </p>

      {current && deck ? (
        <>
          <section aria-label="Flashcard" className="mt-3 rounded-card border border-line bg-surface shadow-card">
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 font-mono text-label uppercase text-muted sm:px-6">
              <span className="whitespace-nowrap"><span aria-hidden="true" className="mr-2">{deck.glyph}</span>{deck.label}</span>
              {/* The one live line: says which card and side, not the whole card. */}
              <span aria-live="polite" aria-atomic="true" className="whitespace-nowrap tabular-nums">
                {flipped ? "Answer · " : ""}
                {loaded ? (
                  <><span className="sr-only">Card </span>{idx + 1}<span aria-hidden="true"> / </span><span className="sr-only"> of </span>{pile.length}</>
                ) : (
                  <span aria-hidden="true">– / –</span>
                )}
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
          {/* With one card left there's nowhere to move, so they say so by being disabled. */}
          <div className="-mx-5 mt-3 flex justify-between">
            <Button variant="ghost" onClick={() => go(-1)} disabled={pile.length <= 1}><span aria-hidden="true">←</span> Previous</Button>
            <Button variant="ghost" onClick={() => go(1)} disabled={pile.length <= 1}>Next <span aria-hidden="true">→</span></Button>
          </div>
          <p className="mt-4 hidden text-small text-muted sm:block">Tip: F or Space flips the card, A is Again, G is Got it, and ← → move between cards.</p>
        </>
      ) : (
        <div className="mt-3 rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
          <h2 ref={clearRef} tabIndex={-1}>
            <State kind="ok" sr={false} className="text-h3">Deck clear</State>
          </h2>
          <p className="mt-3 text-body text-ink-2">Every card here is marked learned. Pick another deck, or reset this one to go again.</p>
          <Button variant="quiet" className="mt-5" onClick={resetDeck}>Reset deck</Button>
        </div>
      )}
      <p className="mt-8 text-small text-muted">“Got it” takes a card out of the pile; “Again” brings it back three cards later. Progress is saved in this browser only.</p>
    </div>
  );
}
