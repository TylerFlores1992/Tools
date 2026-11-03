/** "Again" always moves a card later and shows the next one, including from the end of the pile. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { againMove } from "./deck.ts";

const pileOf = (order: string[], skip: Set<string> = new Set()) => order.filter((c) => !skip.has(c));

test("Again brings a card back three cards later and shows the next card", () => {
  const order = ["a", "b", "c", "d", "e", "f"];
  const { order: next, pos } = againMove(order, order, 0);
  assert.deepEqual(next, ["b", "c", "d", "a", "e", "f"]);
  assert.equal(next[pos], "b");
});

test("Again on the last card keeps it at the end and wraps to the first card", () => {
  const order = ["a", "b", "c", "d"];
  const { order: next, pos } = againMove(order, order, 3);
  assert.deepEqual(next, ["a", "b", "c", "d"]);
  assert.equal(next[pos], "a", "the card just rated must not come straight back");
});

test("Again near the end moves the card to the end when fewer than three are behind it", () => {
  const order = ["a", "b", "c", "d", "e"];
  const { order: next, pos } = againMove(order, order, 3);
  assert.deepEqual(next, ["a", "b", "c", "e", "d"]);
  assert.equal(next[pos], "e");
});

test("Again works on a filtered pile without losing cards from other decks", () => {
  const order = ["m1", "c1", "m2", "c2", "m3", "c3", "m4"];
  const pile = pileOf(order, new Set(["c1", "c2", "c3"]));
  const { order: next, pos } = againMove(order, pile, 3); // m4, the last math card
  assert.equal(next.length, order.length);
  assert.deepEqual([...next].sort(), [...order].sort());
  const nextPile = pileOf(next, new Set(["c1", "c2", "c3"]));
  assert.equal(nextPile[pos], "m1");
  assert.equal(nextPile.at(-1), "m4");
});

test("Again with one card left keeps it (there's nothing else to show)", () => {
  const { order: next, pos } = againMove(["a", "b"], ["a"], 0);
  assert.deepEqual(next, ["a", "b"]);
  assert.equal(pos, 0);
});

test("the shown card is never the one just rated, wherever it sat", () => {
  const order = Array.from({ length: 7 }, (_, i) => `k${i}`);
  for (let idx = 0; idx < order.length; idx++) {
    const { order: next, pos } = againMove(order, order, idx);
    assert.notEqual(next[pos], order[idx], `idx ${idx}`);
    assert.ok(next.indexOf(order[idx]) > pos || next.indexOf(order[idx]) === next.length - 1, `idx ${idx} moved later`);
  }
});
