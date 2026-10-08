// First-come campgrounds booked as one "Standard" site (2026-10-08). Recreation.gov lists these
// first-come, first-served campgrounds with a single placeholder site named "Standard" in a
// "Scan and Pay" loop (and "ScanPay 2…" management rows at 0,0): you arrive, take any open site and
// pay on the spot in the Recreation.gov app. 130 of the rollout's listings are this, not a unit.
// This reads what RIDB says about each one, for the first-come map (docs/design/campground-maps-first-come.md).
//
//   node studio/campground-maps/first-come.mjs <ridb-dir> <out.json> <facilityId>…
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Parse one RIDB CSV (quoted fields, embedded newlines) into rows of objects. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...rest] = rows;
  const keys = head.map((k) => k.replace(/^﻿/, ""));
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** A campground's site count, only when its description states one plainly ("16 campsites",
    "12 sites"); null otherwise. A number we can't find is never guessed. */
export function siteCount(description) {
  const t = text(description);
  // Not a number that names particular sites ("the favored 11 and 12 campsites").
  const m = t.match(/(?<!\band\s|,\s|#)\b(\d{1,3})\s+(?:(?:single|family|individual|tent|rv|primitive|developed|campground)\s+)?(?:campsites|camp sites|sites|campsite units)\b/i);
  return m ? Number(m[1]) : null;
}

/** What the facility's description says about the place, as flags a person can check. */
export function descriptionFlags(description) {
  const t = text(description).toLowerCase();
  return {
    firstCome: /first[- ]come,?\s*first[- ]served/.test(t),
    scanAndPay: /scan and pay/.test(t),
    closed: /\b(?:remains|is|currently) closed\b/.test(t),
  };
}

const AMENITY = [
  [/^(?:ACCESSIBLE )?VAULT TOILETS?$/i, "Vault toilets"],
  [/^(?:ACCESSIBLE )?FLUSH TOILETS?$/i, "Flush toilets"],
  [/^DRINKING WATER$|^POTABLE WATER$/i, "Drinking water"],
  [/^NON-POTABLE WATER$/i, "Water you have to treat"],
  [/^CAMPFIRE RINGS$|^FIRE RINGS$/i, "Fire rings"],
  [/^PICNIC TABLES$/i, "Picnic tables"],
  [/^TRASH COLLECTION$|^TRASH$/i, "Trash collection"],
  [/^BOAT RAMP$/i, "Boat ramp"],
];

/** The facts for one first-come listing from the RIDB tables. */
export function factsFor(id, { facilities, campsites, attributes }) {
  const fac = facilities.find((f) => f.FacilityID === id);
  if (!fac) throw new Error(`${id}: not in RIDB Facilities`);
  const site = campsites.find((c) => c.FacilityID === id && c.CampsiteName.trim().toLowerCase() === "standard");
  const attrs = site ? attributes.filter((a) => a.EntityID === site.CampsiteID) : [];
  const attr = (name) => attrs.find((a) => a.AttributeName.toLowerCase() === name.toLowerCase())?.AttributeValue ?? null;
  const num = (v) => (v != null && /^\d+$/.test(v) ? Number(v) : null);
  const amenities = [...new Set(attrs.map((a) => AMENITY.find(([re]) => re.test(a.AttributeName.trim()))?.[1]).filter(Boolean))];
  return {
    id,
    name: fac.FacilityName,
    sites: siteCount(fac.FacilityDescription ?? ""),
    ...descriptionFlags(fac.FacilityDescription ?? ""),
    access: attr("Site Access"),
    maxPeople: num(attr("Max Num of People")),
    maxVehicles: num(attr("Max Num of Vehicles")),
    pets: attr("Pets Allowed"),
    campfires: attr("Campfire Allowed"),
    amenities,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, out, ...ids] = process.argv.slice(2);
  if (!dir || !out || !ids.length) { console.error("usage: first-come.mjs <ridb-dir> <out.json> <facilityId>…"); process.exit(1); }
  const read = (f) => parseCsv(readFileSync(join(dir, f), "utf8"));
  const tables = { facilities: read("Facilities_API_v1.csv"), campsites: read("Campsites_API_v1.csv"), attributes: read("CampsiteAttributes_API_v1.csv") };
  const facts = Object.fromEntries(ids.map((id) => [id, factsFor(id, tables)]));
  writeFileSync(out, JSON.stringify({ version: 1, source: "RIDB full export (CC BY 4.0)", facts }, null, 1) + "\n");
  console.log(`${out}: ${ids.length} listings`);
}
