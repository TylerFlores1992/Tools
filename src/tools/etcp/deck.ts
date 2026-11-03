// Flashcard pile moves, as pure functions so the rules are tested rather than eyeballed.

/** How many cards later "Again" brings a card back. */
export const AGAIN_GAP = 3;

/**
 * "Again": move the card at `idx` of `pile` later, `AGAIN_GAP` cards behind where it was, or to
 * the end of the pile when fewer than that are left behind it. `order` is the whole deck order
 * (the pile is the part of it in the current deck that isn't learned yet); the card moves in it.
 *
 * Returns the new order and the position to show next: the card that was behind it, or the first
 * card when it was the last one. The card you just rated is never shown straight back, unless
 * it's the only card left.
 */
export function againMove(order: readonly string[], pile: readonly string[], idx: number): { order: string[]; pos: number } {
  const id = pile[idx];
  const rest = pile.filter((c) => c !== id);
  if (id === undefined || rest.length === 0) return { order: [...order], pos: 0 };
  // In the pile without this card, the one AGAIN_GAP behind it now sits at idx + GAP - 1.
  const after = rest[Math.min(idx + AGAIN_GAP - 1, rest.length - 1)];
  const next = order.filter((c) => c !== id);
  next.splice(next.indexOf(after) + 1, 0, id);
  return { order: next, pos: idx < rest.length ? idx : 0 };
}
