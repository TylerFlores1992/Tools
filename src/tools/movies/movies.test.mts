/** Top Movies: shelves, sorting, words and the settings form. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { genresOf, isImdbId, pick, readSettingsForm, runtime, tabOf, votes, whyHidden } from "./format.ts";
import type { Movie, MoviesState } from "./types.ts";

const movie = (o: Partial<Movie>): Movie => ({
  key: "tt1", title: "A", year: 2026, rating: 7.5, votes: 5000, genres: "Drama", minutes: 120, recent: true, foreign: false,
  score: 7, added: 100, icon: "", trailer: "", is4k: false, watchedPos: 0, hidden: "", ...o,
});
const limits: MoviesState["limits"] = {
  days: { label: "Days on the server", min: 7, max: 730, step: 1 },
  minRating: { label: "Minimum rating", min: 5, max: 9, step: 0.1 },
  minVotes: { label: "Minimum votes", min: 500, max: 100000, step: 1 },
  newYears: { label: "New releases (years)", min: 1, max: 10, step: 1 },
  watchedPct: { label: "Watched after (%)", min: 5, max: 95, step: 1 },
  showForeign: { label: "Foreign-language movies", bool: true },
};
const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });
const good = { days: "180", minRating: "7.25", minVotes: "2000", newYears: "3", watchedPct: "20" };

test("tabs: hidden wins, then new vs older by release", () => {
  assert.equal(tabOf(movie({ recent: true })), "new");
  assert.equal(tabOf(movie({ recent: false })), "older");
  assert.equal(tabOf(movie({ recent: true, hidden: "seen" })), "hidden");
});

test("pick: filters by tab and genre, sorts three ways", () => {
  const ms = [
    movie({ key: "tt1", score: 7.1, added: 300, year: 2025, genres: "Comedy,Drama" }),
    movie({ key: "tt2", score: 7.9, added: 100, year: 2024, genres: "Action" }),
    movie({ key: "tt3", score: 7.5, added: 200, year: 2026, genres: "Drama" }),
    movie({ key: "tt4", score: 9, recent: false }),
  ];
  assert.deepEqual(pick(ms, "new", "", "score").map((m) => m.key), ["tt2", "tt3", "tt1"]);
  assert.deepEqual(pick(ms, "new", "", "added").map((m) => m.key), ["tt1", "tt3", "tt2"]);
  assert.deepEqual(pick(ms, "new", "", "year").map((m) => m.key), ["tt3", "tt1", "tt2"]);
  assert.deepEqual(pick(ms, "new", "Drama", "score").map((m) => m.key), ["tt3", "tt1"]);
  assert.deepEqual(pick(ms, "older", "", "score").map((m) => m.key), ["tt4"]);
  assert.deepEqual(genresOf(ms), ["Action", "Comedy", "Drama"]);
});

test("words: runtime, votes, why hidden", () => {
  assert.equal(runtime(172), "2h 52m");
  assert.equal(runtime(48), "48m");
  assert.equal(runtime(0), "");
  assert.equal(votes(566637), "567k votes");
  assert.equal(votes(3957), "4k votes");
  assert.equal(votes(2290), "2.3k votes");
  assert.equal(votes(850), "850 votes");
  assert.equal(whyHidden(movie({ hidden: "watched", watchedPos: 0.62 })), "Watched (62% in)");
  assert.equal(whyHidden(movie({ hidden: "not interested" })), "You marked it not for you");
  assert.ok(isImdbId("tt33764258") && !isImdbId("33764258") && !isImdbId("tt1; rm"));
});

test("settings form: reads numbers and the checkbox, rounds to the step", () => {
  const r = readSettingsForm(form({ ...good, showForeign: "on" }), limits);
  assert.deepEqual(r, { ok: true, value: { days: 180, minRating: 7.3, minVotes: 2000, newYears: 3, watchedPct: 20, showForeign: true } });
  const off = readSettingsForm(form(good), limits);
  assert.ok(off.ok && off.value.showForeign === false);
});

test("settings form: out of range or empty is refused in words", () => {
  assert.deepEqual(readSettingsForm(form({ ...good, minRating: "12" }), limits), { ok: false, message: "Minimum rating must be between 5 and 9." });
  assert.deepEqual(readSettingsForm(form({ ...good, minVotes: "100" }), limits), { ok: false, message: "Minimum votes must be between 500 and 100000." });
  assert.deepEqual(readSettingsForm(form({ ...good, days: "" }), limits), { ok: false, message: "Days on the server: enter a number." });
  assert.deepEqual(readSettingsForm(form({ ...good, days: "lots" }), limits), { ok: false, message: "Days on the server: enter a number." });
});
