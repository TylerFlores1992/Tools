import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS, DECKS, parseInline } from "./cards.ts";

const card = (q: RegExp) => {
  const c = CARDS.find((x) => q.test(x.q));
  assert.ok(c, `no card matching ${q}`);
  return c;
};

test("73 cards, unique ids, every deck known and used", () => {
  assert.equal(CARDS.length, 73);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
  for (const d of DECKS) assert.ok(CARDS.some((c) => c.deck === d.key), d.key);
  assert.equal(new Set(DECKS.map((d) => d.glyph)).size, DECKS.length, "each deck needs its own glyph");
});

test("marks are balanced: every ** and ~ opens and closes on the same line", () => {
  const bad = CARDS.flatMap((c) => c.a.split("\n").filter((l) => (l.match(/\*\*/g) ?? []).length % 2 || (l.match(/~/g) ?? []).length % 2).map((l) => `${c.id}: ${l}`));
  assert.deepEqual(bad, []);
});

test("parseInline splits bold and subscript runs", () => {
  assert.deepEqual(parseInline("V~A~ = **W**"), [{ text: "V" }, { text: "A", sub: true }, { text: " = " }, { text: "W", bold: true }]);
  assert.deepEqual(parseInline("plain"), [{ text: "plain" }]);
});

test("worked examples on the cards are arithmetically right", () => {
  assert.match(card(/^Design factor/).a, /875 lb/); // 7,000 ÷ 8
  assert.equal(7000 / 8, 875);
  assert.match(card(/Symmetric 2-leg bridle/).a, /625 lb/);
  assert.equal(500 * (10 / 8), 625);
  assert.match(card(/Finding a bridle leg length/).a, /10′/);
  assert.equal(Math.hypot(8, 6), 10);
  assert.match(card(/Simple span beam/).a, /600 lb.*400 lb/);
  assert.equal((1000 * 6) / 10, 600);
  // Included-angle rules: each leg = (W/2) / cos(half angle)
  const leg = (included: number) => 0.5 / Math.cos((included / 2) * (Math.PI / 180));
  assert.equal(leg(60).toFixed(2), "0.58");
  assert.equal(leg(90).toFixed(2), "0.71");
  assert.equal(leg(120).toFixed(2), "1.00");
});

test("tilting: with the CG below the picks, the HIGHER pick gains load (the original card had it backward)", () => {
  // Picks at (±a, 0) on the object, CG at (0, −h). Tilt by θ so the left end drops.
  const a = 2, h = 1, t = (10 * Math.PI) / 180;
  const rot = ([x, y]: [number, number]): [number, number] => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
  const [left, right, cg] = [rot([-a, 0]), rot([a, 0]), rot([0, -h])];
  assert.ok(right[1] > left[1], "right pick is the higher one");
  // Vertical lines: each pick's share is set by the CG's horizontal position between them.
  const rightShare = (cg[0] - left[0]) / (right[0] - left[0]);
  assert.ok(rightShare > 0.5, `higher pick share ${rightShare}`);
  assert.match(card(/^Tilting/).a, /toward the \*\*higher\*\* pick/);
});

test("exam outlines on the cards add up to 150 questions (ETCP published outlines, checked 2026-10-02)", () => {
  for (const re of [/Arena exam covers/, /Theatre exam covers/]) {
    const nums = [...card(re).a.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]));
    assert.equal(nums.reduce((s, n) => s + n, 0), 150, re.source);
  }
});
