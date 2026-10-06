import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_FILTERS } from "../ui/FilterPanel.tsx";
import { search, suggest } from "./explore-data.ts";

const q = (over: object = {}) => ({ radius: 10, start: null, end: null, flexNights: null, filters: EMPTY_FILTERS, ...over });
const states = (r: ReturnType<typeof search>) => Object.fromEntries(r.map((c) => [c.name, c.hasAvailability]));

test("no dates: nothing is claimed about availability", () => {
  assert.ok(search(q()).every((c) => c.hasAvailability === undefined));
});

test("Jul 18-21 inside 10 miles shows all four of CampHawk's result states", () => {
  assert.deepEqual(states(search(q({ start: "2026-07-18", end: "2026-07-21" }))), {
    "Upper Pines": true, "Lower Pines": undefined, "North Pines": false, "Camp 4": undefined,
  });
});

test("flexible finds a shorter run inside the window; exact needs every night", () => {
  const crane = (over: object) => search(q({ radius: 25, ...over })).find((c) => c.name === "Crane Flat")!.hasAvailability;
  assert.equal(crane({ start: "2026-07-18", end: "2026-07-21" }), false);
  assert.equal(crane({ start: "2026-07-14", end: "2026-07-24", flexNights: 2 }), true);
  assert.equal(crane({ start: "2026-07-14", end: "2026-07-24", flexNights: 3 }), false);
});

test("radius and filters narrow; pad length leaves out sites with no length on file", () => {
  assert.equal(search(q({ radius: 100 })).length, 10);
  assert.ok(!search(q({ filters: { ...EMPTY_FILTERS, rvLength: 24 } })).some((c) => c.name === "Camp 4"));
  assert.deepEqual(search(q({ radius: 100, filters: { ...EMPTY_FILTERS, electric: true } })).map((c) => c.name), ["Dimond O", "Calaveras Big Trees State Park"]);
});

test("the place box needs two letters and matches towns and campgrounds", () => {
  assert.deepEqual(suggest("y"), []);
  assert.equal(suggest("pines").length, 3);
});
