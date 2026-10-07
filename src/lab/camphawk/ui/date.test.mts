import assert from "node:assert/strict";
import test from "node:test";
import { formatRange, nightsBetween, stayDates, thisWeekendRange } from "./date.ts";

// Run in a US timezone on purpose: that is where CampHawk's UTC-parse bug shows.
process.env.TZ = "America/Los_Angeles";

test("this weekend is Friday to Sunday from the lab's Monday, Jul 6", () => {
  assert.deepEqual(thisWeekendRange(), { start: "2026-07-10", end: "2026-07-12" });
});

test("ranges and stays read the way CampHawk writes them", () => {
  assert.equal(formatRange("2026-07-18", "2026-07-21"), "Sat Jul 18 – Tue Jul 21");
  assert.equal(formatRange("2026-07-18", null), "Sat Jul 18 – …");
  assert.equal(stayDates("2026-07-18", "2026-07-21"), "Jul 18–21");
  assert.equal(stayDates("2026-07-30", "2026-08-02"), "Jul 30 – Aug 2");
  assert.equal(nightsBetween("2026-07-30", "2026-08-02"), 3);
});
