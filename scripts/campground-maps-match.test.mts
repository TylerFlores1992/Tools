import assert from "node:assert/strict";
import test from "node:test";
import { matchUnits, typeOf } from "../studio/campground-maps/match.mjs";

// Shapes copied from real Jedediah Smith rows (RC's unit list, State Parks' CampsiteSpur layer).
const pt = (SITE_NBR: string, SITE_TYPE = "Tent, Non-elect, std", CampgroundName = "Jedediah Smith CG", at = [0, 0]) =>
  ({ properties: { SITE_NBR, SITE_TYPE, CampgroundName }, geometry: { type: "Point", coordinates: at } });
const unit = (name: string) => ({ name, code: name.split("#").pop()!.trim(), loop: "Main Loop" });
const names = (r: { matched: { unit: { name: string } }[] }) => r.matched.map((m) => m.unit.name);

test("a campsite matches its State Parks point by number, leading zeros or not", () => {
  const r = matchUnits([unit("Campsite #7"), unit("Campsite #033")], [pt("7"), pt("33")]);
  assert.deepEqual(names(r), ["Campsite #7", "Campsite #033"]);
});

test("RC's cabin J24 is State Parks' cabin 24, and never campsite 24 (kinds must agree)", () => {
  const cabin = pt("24", "Cabin"), site = pt("24");
  const r = matchUnits([unit("Cabin (6 People) #J24")], [site, cabin]);
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].f, cabin);
  const r2 = matchUnits([unit("Campsite #24")], [cabin]);
  assert.deepEqual(r2.notFound, ["Campsite #24"], "a campsite never takes a cabin's point");
});

test("a number State Parks records twice is left off and reported, never guessed (Jedediah Smith's 56)", () => {
  const r = matchUnits([unit("Campsite #56"), unit("Campsite #57")], [pt("56", undefined, undefined, [1, 1]), pt("56", undefined, undefined, [2, 2])]);
  assert.equal(r.matched.length, 0);
  assert.deepEqual(r.dupes, ["Campsite #56"]);
  assert.deepEqual(r.notFound, ["Campsite #57"]);
});

test("the hike-and-bike area's 'A' is not the campground's walk-in site A", () => {
  const camp = pt("A"), hike = pt("A", undefined, "Jedediah Smith Redwoods Hike and Bike Camp Area");
  const r = matchUnits([unit("Tent Only - Walk-In #A")], [hike, camp]);
  assert.equal(r.matched[0].f, camp);
});

test("hike-in and boat-in units are not drawn, and say so", () => {
  const r = matchUnits([unit("Hike In Primitive Campsite #HBA"), unit("Boat In Campsite #3")], [pt("3")]);
  assert.equal(r.matched.length, 0);
  assert.deepEqual(r.skipped, ["Hike In Primitive Campsite #HBA", "Boat In Campsite #3"]);
});

test("State Parks' site types read as the lab's type labels", () => {
  assert.equal(typeOf("Tent, Non-elect, std"), "TENT NONELECTRIC");
  assert.equal(typeOf("RV, Elect, std"), "RV ELECTRIC");
  assert.equal(typeOf("Cabin"), "CABIN");
});
