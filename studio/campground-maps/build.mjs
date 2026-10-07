// Builds one campground's site map from free public data into a small JSON the lab draws as SVG.
//
//   node studio/campground-maps/build.mjs <ridb-dir> [facility-id]
//
// <ridb-dir> holds the unzipped RIDB full export (Campsites_API_v1.csv,
// CampsiteAttributes_API_v1.csv), downloaded with no key from
// https://ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip (248 MB; not committed).
// Everything else is fetched live from federal map services. Sources and licences: README.md.
//
// The output is in metres on a local flat projection (north up), rounded to 0.1 m, because a
// campground is under a kilometre across and an SVG wants plain x/y. Nothing here is traced from
// anyone's map picture: site points are Recreation.gov's published coordinates, the roads,
// restrooms and parking are the Park Service's own GIS, and the river is USGS hydrography.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { NHD, arcgis, kept, lines, makeGeo, named, rings } from "./geo.mjs";

const [ridbDir, facilityId = "232447"] = process.argv.slice(2);
if (!ridbDir) { console.error("usage: build.mjs <ridb-dir> [facility-id]"); process.exit(1); }
const OUT = join(import.meta.dirname, "../../src/lab/camphawk/round2/maps");

/** RFC 4180 CSV (quoted fields, doubled quotes, newlines inside quotes), streamed by row. */
function* csvRows(path) {
  const s = readFileSync(path, "utf8").replace(/^﻿/, "");
  let row = [], field = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = ""; yield row; row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); yield row; }
}
function* csvObjects(path) {
  let head;
  for (const r of csvRows(path)) {
    if (!head) { head = r; continue; }
    if (r.length === 1 && r[0] === "") continue;
    yield Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""]));
  }
}

// --- Campsites (RIDB) ---
const sites = [];
for (const r of csvObjects(join(ridbDir, "Campsites_API_v1.csv"))) {
  if (r.FacilityID !== facilityId) continue;
  sites.push({ ridbId: r.CampsiteID, name: r.CampsiteName, type: r.CampsiteType, loop: r.Loop, accessible: r.CampsiteAccessible === "true", lat: Number(r.CampsiteLatitude) || 0, lon: Number(r.CampsiteLongitude) || 0 });
}
if (!sites.length) { console.error(`no campsites for facility ${facilityId}`); process.exit(1); }
const byRidb = new Map(sites.map((s) => [s.ridbId, s]));
const attrs = new Map();
for (const r of csvObjects(join(ridbDir, "CampsiteAttributes_API_v1.csv"))) {
  if (!byRidb.has(r.EntityID)) continue;
  (attrs.get(r.EntityID) ?? attrs.set(r.EntityID, {}).get(r.EntityID))[r.AttributeName] = r.AttributeValue;
}

const placed = sites.filter((s) => s.lat && s.lon);
const geo = makeGeo(placed.map((s) => [s.lon, s.lat]));
const { xy, frame, bbox, pathOf, labelFor, spaced } = geo;

const NPS = "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets";
const [roads, pois, buildings, lots, trails, water, flowlines] = await Promise.all([
  arcgis(`${NPS}/NPS_Public_Roads_Geographic/FeatureServer/0`, bbox, "RDNAME,RDCLASS,RDONEWAY,RDSTATUS,PUBLICDISPLAY"),
  arcgis(`${NPS}/NPS_Public_POIs_Geographic/FeatureServer/0`, bbox, "POINAME,POITYPE,PUBLICDISPLAY"),
  arcgis(`${NPS}/NPS_Public_Buildings_Geographic/FeatureServer/0`, bbox, "BLDGNAME,BLDGTYPE,PUBLICDISPLAY"),
  arcgis(`${NPS}/NPS_Public_ParkingLots_Geographic/FeatureServer/0`, bbox, "LOTNAME,PUBLICDISPLAY"),
  arcgis(`${NPS}/NPS_Public_Trails_Geographic/FeatureServer/0`, bbox, "TRLNAME,TRLCLASS,TRLUSE,PUBLICDISPLAY"),
  arcgis(`${NHD}/9`, bbox, "FTYPE,FCODE"),
  arcgis(`${NHD}/6`, bbox, "gnis_name,fcode"),
]);
const awayFromRoad = geo.awayFromRoad(roads);
const labels = spaced([
  ...named(roads.filter((f) => f.properties.RDCLASS !== "Service"), "RDNAME").map((n) => labelFor(n, "road", roads.filter((f) => f.properties.RDNAME === n))),
  ...named(trails, "TRLNAME").filter((n) => !named(roads, "RDNAME").includes(n)).sort((a, b) => Number(/bike path/i.test(a)) - Number(/bike path/i.test(b))).map((n) => labelFor(n, "trail", trails.filter((f) => f.properties.TRLNAME === n))),
  ...named(flowlines, "gnis_name").map((n) => labelFor(n, "water", flowlines.filter((f) => f.properties.gnis_name === n))),
]);
const out = {
  facilityId,
  source: { ridbExport: "RIDB full export (CSV), Recreation.gov, CC BY 4.0", built: new Date().toISOString().slice(0, 10) },
  frame,
  labels,
  roads: kept(roads.map((f) => ({ name: f.properties.RDNAME ?? "", cls: f.properties.RDCLASS ?? "", oneWay: f.properties.RDONEWAY ?? "", d: pathOf(lines(f.geometry), false) }))),
  trails: kept(trails.map((f) => ({ name: f.properties.TRLNAME ?? "", d: pathOf(lines(f.geometry), false) }))),
  lots: kept(lots.map((f) => ({ d: pathOf(rings(f.geometry), true) }))),
  water: kept(water.map((f) => ({ fcode: f.properties.FCODE ?? f.properties.fcode, d: pathOf(rings(f.geometry), true) }))),
  buildings: kept(buildings.map((f) => ({ name: f.properties.BLDGNAME ?? "", type: f.properties.BLDGTYPE ?? "", d: pathOf(rings(f.geometry), true) }))),
  pois: pois.filter((f) => f.geometry?.type === "Point").map((f) => ({ f, at: xy(f.geometry.coordinates) })).filter(({ at: [x, y] }) => x >= frame.x && x <= frame.x + frame.w && y >= frame.y && y <= frame.y + frame.h).map(({ f, at }) => ({ name: f.properties.POINAME ?? "", type: f.properties.POITYPE ?? "", at })),
  sites: sites
    .filter((s) => s.type !== "MANAGEMENT") // staff sites, never bookable
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((s) => {
      const a = attrs.get(s.ridbId) ?? {};
      const num = (k) => (Number(a[k]) > 0 ? Number(a[k]) : undefined); // RIDB writes 0 for "not recorded"
      return {
        name: s.name,
        type: s.type,
        at: s.lat && s.lon ? xy([s.lon, s.lat]) : null,
        out: s.lat && s.lon ? awayFromRoad(xy([s.lon, s.lat])) : undefined,
        accessible: s.accessible || a.Accessibility === "Y",
        maxVehicleFt: num("Max Vehicle Length"),
        maxPeople: num("Max Num of People"),
        backIn: /back-?in/i.test(a["Driveway Entry"] ?? "") || undefined,
        shade: a.Shade === "Yes" || undefined,
      };
    }),
};
mkdirSync(OUT, { recursive: true });
const file = join(OUT, `ridb-${facilityId}.json`);
writeFileSync(file, JSON.stringify(out) + "\n");
const unplaced = out.sites.filter((s) => !s.at).map((s) => s.name);
console.log(`${file}\n  ${out.sites.length} bookable sites (${unplaced.length} without a point${unplaced.length ? ": " + unplaced.join(", ") : ""})`);
console.log(`  ${out.roads.length} road parts, ${out.trails.length} trails, ${out.lots.length} lots, ${out.water.length} water, ${out.buildings.length} buildings, ${out.pois.length} points`);
console.log(`  frame ${frame.w} x ${frame.h} m`);
