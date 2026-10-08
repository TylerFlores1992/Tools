import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, siteCount, descriptionFlags, factsFor } from "../studio/campground-maps/first-come.mjs";

test("a first-come campground's site count is read only when its description states it", () => {
  assert.equal(siteCount("<p>Elbert Creek is a first-come, first-served campground, with 17 sites, adjacent to the Mount Massive Wilderness.</p>"), 17);
  assert.equal(siteCount("<h2>Facilities</h2><p>3 campsites are located in this area.</p>"), 3);
  assert.equal(siteCount("This campground has 9 campsites at an elevation of 9,700 feet."), 9);
  assert.equal(siteCount("This is a tent-only campground with 19 sites located on the east bank."), 19);
  // Numbers that name particular sites, or none at all, are not a count.
  assert.equal(siteCount("Most campsites are less shaded than the favored 11 and 12 campsites, so please feel free."), null);
  assert.equal(siteCount("Sites 4 and 5 sites are near the creek."), null);
  assert.equal(siteCount("This location is available on a first-come, first-served basis only."), null);
});

test("a description's flags: first come, Scan and Pay, and a closure notice", () => {
  const d = "<p><strong>Blair Lake Campground remains closed due to impacts from the Cedar Creek Fire.</strong></p><p>This location is available on a first-come, first-served basis only. … the Scan and Pay feature.</p>";
  assert.deepEqual(descriptionFlags(d), { firstCome: true, scanAndPay: true, closed: true });
  assert.deepEqual(descriptionFlags("<p>Reservations are required.</p>"), { firstCome: false, scanAndPay: false, closed: false });
});

test("a listing's facts come from its Standard site's attributes, and the CSV reader handles quoted fields", () => {
  const csv = (rows: string[][]) => rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const facilities = parseCsv("﻿" + csv([["FacilityID", "FacilityName", "FacilityDescription"], ["10165105", "Alder Springs", "<p>first-come, first-served, with \"14 sites\",\nby the creek. Scan and Pay.</p>"]]));
  const campsites = parseCsv(csv([["CampsiteID", "FacilityID", "CampsiteName"], ["10165107", "10165105", "ScanPay 2"], ["10165106", "10165105", "Standard"]]));
  const attributes = parseCsv(csv([["EntityID", "AttributeName", "AttributeValue"], ["10165106", "Max Num of People", "8"], ["10165106", "Site Access", "Drive-In"], ["10165106", "ACCESSIBLE VAULT TOILETS", "Accessible Vault Toilets"], ["10165106", "NON-POTABLE WATER", "Non-Potable Water"], ["10165107", "Max Num of People", "99"]]));
  const f = factsFor("10165105", { facilities, campsites, attributes });
  assert.equal(f.name, "Alder Springs");
  assert.equal(f.sites, 14);
  assert.equal(f.maxPeople, 8, "the Standard site's own attribute, not a management row's");
  assert.equal(f.access, "Drive-In");
  assert.deepEqual(f.amenities, ["Vault toilets", "Water you have to treat"]);
  assert.equal(f.firstCome, true);
  assert.throws(() => factsFor("1", { facilities, campsites, attributes }), /not in RIDB/);
});
