import assert from "node:assert/strict";
import test from "node:test";
import { poiKind } from "../studio/campground-maps/pois.mjs";

test("the Park Service's names for restrooms, taps, dump stations and parking become the map's", () => {
  for (const t of ["Restroom", "Toilet", "Vault Toilet"]) assert.equal(poiKind(t), "Restroom");
  for (const t of ["Water", "Potable Water", "Drinking Water"]) assert.equal(poiKind(t), "Water");
  assert.equal(poiKind("Sanitary Disposal Station"), "Dump Station");
  assert.equal(poiKind("Parking"), "Parking Lot");
  assert.equal(poiKind("Bus Stop / Shuttle Stop"), "Bus Stop / Shuttle Stop");
});

test("points the map has no use for are dropped, and a boat launch is never drinking water", () => {
  for (const t of ["Campsite", "Food Box / Food Cache", "Electrical Hookup", "Water Access", "Dumpster", "Recycle", "", undefined]) assert.equal(poiKind(t), null, String(t));
});
