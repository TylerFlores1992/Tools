/**
 * The Recordings pages' words and times. Times are real Pacific moments, including a DST change
 * (Nov 1, 2026), because the page renders on UTC servers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { adsText, clash, dayLabel, daysApart, groupByDay, padText, plural, relIn, size, when } from "./format.ts";
import { feedValue, readSeriesForm } from "./series-form.ts";
import type { Upcoming } from "./types.ts";

const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });

test("series form: reads the feed, mode and options", () => {
  const r = readSeriesForm(form({ title: " Survivor ", feed: feedValue(430060, "CBS 2 Los Angeles"), gid: "pub.KCBS-DT.us_locals1", mode: "new", keep: "5", padB: "", padA: "30" }));
  assert.deepEqual(r, { ok: true, value: { title: "Survivor", channel: 430060, channelName: "CBS 2 Los Angeles", guideId: "pub.KCBS-DT.us_locals1", newOnly: true, keep: 5, padBeforeMin: null, padAfterMin: 30 } });
  const all = readSeriesForm(form({ title: "News", feed: "7::A::B", mode: "all" }));
  assert.ok(all.ok && !all.value.newOnly && all.value.channelName === "A::B");
});

test("series form: refuses a missing show or channel, clamps the rest", () => {
  assert.deepEqual(readSeriesForm(form({ feed: "1::x" })), { ok: false, message: "Which show?" });
  assert.deepEqual(readSeriesForm(form({ title: "X", feed: "abc::x" })), { ok: false, message: "Pick a channel." });
  const r = readSeriesForm(form({ title: "X", feed: "1::x", padA: "999", keep: "-3" }));
  assert.ok(r.ok && r.value.padAfterMin === 180 && r.value.keep === 0);
});

const pt = (iso: string) => Date.parse(iso); // write times with their offset
const NOW = pt("2026-10-30T21:40:00-07:00"); // Friday evening, PDT

test("days apart follow the Pacific calendar, not UTC", () => {
  // 11:30 PM Friday Pacific is already Saturday in UTC; still "today".
  assert.equal(daysApart(pt("2026-10-30T23:30:00-07:00"), NOW), 0);
  assert.equal(daysApart(pt("2026-10-31T00:30:00-07:00"), NOW), 1);
  // Across the DST change (PDT -> PST on Nov 1).
  assert.equal(daysApart(pt("2026-11-04T20:00:00-08:00"), NOW), 5);
});

test("day headings: tonight, today, tomorrow, then the date", () => {
  assert.equal(dayLabel(pt("2026-10-30T22:00:00-07:00"), NOW), "Tonight");
  assert.equal(dayLabel(pt("2026-10-30T09:00:00-07:00"), pt("2026-10-30T08:00:00-07:00")), "Today");
  assert.equal(dayLabel(pt("2026-10-31T21:30:00-07:00"), NOW), "Tomorrow");
  assert.equal(dayLabel(pt("2026-11-04T20:00:00-08:00"), NOW), "Wednesday, Nov 4");
});

test("short times read naturally", () => {
  assert.equal(when(pt("2026-10-31T21:30:00-07:00"), NOW), "Tomorrow, 9:30 PM");
  assert.equal(when(pt("2026-11-04T20:00:00-08:00"), NOW), "Wed, Nov 4, 8:00 PM");
  assert.equal(relIn(NOW + 25 * 60000, NOW), "in 25 min");
  assert.equal(relIn(NOW + 5 * 3600000, NOW), "in 5 h");
  assert.equal(relIn(NOW + 5 * 86400000, NOW), "in 5 days");
});

test("sizes and plurals", () => {
  assert.equal(size(1.7e9), "1.7 GB");
  assert.equal(size(44e6), "44 MB");
  assert.equal(size(2.5e12), "2.5 TB");
  assert.equal(plural(1, "episode"), "1 episode");
  assert.equal(plural(3, "episode"), "3 episodes");
  assert.equal(plural(2, "series"), "2 series");
});

const up = (p: Partial<Upcoming>): Upcoming => ({
  key: "1|1", ruleId: "a", show: "Survivor", se: "", sub: "", channelName: "CBS 2", channel: 1,
  start: NOW, stop: NOW, from: NOW, until: NOW, state: "scheduled", isNew: true, once: false, mb: 0, ...p,
});

test("upcoming groups by day, with what's recording first", () => {
  const groups = groupByDay([
    up({ show: "B", start: pt("2026-11-04T20:00:00-08:00"), from: pt("2026-11-04T19:58:00-08:00") }),
    up({ show: "A", start: pt("2026-10-31T21:30:00-07:00"), from: pt("2026-10-31T21:28:00-07:00") }),
    up({ show: "R", state: "recording", start: NOW - 60000, from: NOW - 120000 }),
  ], NOW);
  assert.deepEqual(groups.map((g) => [g.label, g.items.map((i) => i.show)]), [
    ["Recording now", ["R"]], ["Tomorrow", ["A"]], ["Wednesday, Nov 4", ["B"]],
  ]);
});

test("padding falls back to the defaults", () => {
  const d = { padBeforeMin: 2, padAfterMin: 15 };
  assert.equal(padText({ padBeforeMin: null, padAfterMin: null }, d), "2 min early · 15 min late");
  assert.equal(padText({ padBeforeMin: 0, padAfterMin: 30 }, d), "0 min early · 30 min late");
});

test("ads wording never relies on colour alone", () => {
  assert.deepEqual(adsText({ state: "removed", breaks: 8, savedMin: 31 }), { kind: "ok", text: "Ad-free · 31 min of ads removed" });
  assert.equal(adsText({ state: "pending" }).text, "Removing ads…");
  assert.equal(adsText({ state: "kept", note: "x" }).text, "Has ads");
});

test("clash warnings: more channels than lines is a real clash", () => {
  assert.match(clash({ overlap: 3, state: "scheduled" }, 2) ?? "", /one will be cut/);
  assert.equal(clash({ overlap: 2, state: "scheduled" }, 2), "Uses all 2 lines while it records");
  assert.equal(clash({ overlap: 1, state: "scheduled" }, 2), null);
  assert.equal(clash({ overlap: 3, state: "skipped" }, 2), null);
});
