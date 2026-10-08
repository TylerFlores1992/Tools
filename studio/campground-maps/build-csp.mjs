// Builds a ReserveCalifornia campground's site map from California State Parks' own campsite
// points, plus OpenStreetMap roads/restrooms/water and the USGS river, into the same JSON the
// lab draws for Recreation.gov campgrounds.
//
//   node studio/campground-maps/build-csp.mjs <spec.json>
//
// spec: { "key": "jedediah-smith", "unit": 102, "campgroundLike": "Jed%",
//         "facilities": [{ "id": 517, "loop": "Main Loop" }, { "id": 791, "loop": "Outer Loop" }] }
//
// PENDING STATE PARKS' PERMISSION. Their GIS terms ask for approval before commercial use, so the
// output goes to public/lab-local/ (git-ignored): it renders on a local run only and is never
// committed to this public repository or deployed. Facts read from ReserveCalifornia: which site
// numbers are bookable and which loop each is on (its own area names, "Main Loop (sites 1-44,
// 92-106)"). Nothing from RC's map pictures is used.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { NHD, arcgis, getText, kept, lines, makeGeo, named, rings } from "./geo.mjs";
import { matchUnits, typeOf } from "./match.mjs";

const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
const OUT = join(import.meta.dirname, "../../public/lab-local");
const CSP = "https://services2.arcgis.com/AhxrK3F6WM8ECvDi/arcgis/rest/services/InternalCampsiteSpur/FeatureServer/0";
const RDR = "https://california-rdr.prod.cali.rd12.recreation-management.tylerapp.com/rdr";

// RC's firewall answers a bare Node fetch with an HTML page; these are the browser-style headers
// CampHawk's own RDR client sends (campsite-finder src/lib/sources/reservecalifornia/providers.ts).
// Run with NODE_USE_ENV_PROXY=1 in a session container, or Node bypasses the proxy and is refused.
const RDR_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

// --- Which units RC sells, and which loop each is on (facts from RC's own unit list). ---
// RC's area names give number RANGES ("sites 1-44, 92-106"), but a range is not a list: at
// Jedediah Smith "24" is a cabin RC sells as J24 in another area. So the units come from RC's
// grid, the same list CampHawk's availability check reads.
const today = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const units = [];
for (const f of spec.facilities) {
  const body = JSON.stringify({ FacilityId: f.id, StartDate: today, EndDate: today, MinDate: today, MaxDate: today, IsADA: false, MinVehicleLength: 0, UnitCategoryId: 0, UnitTypeId: 0, UnitTypesGroupIds: [], SleepingUnitId: 0, InSeasonOnly: false, WebOnly: true, UnitSort: "orderby" });
  const grid = JSON.parse(await getText(`${RDR}/search/grid`, RDR_HEADERS, body));
  const list = Object.values(grid?.Facility?.Units ?? {});
  if (!list.length) throw new Error(`RC area ${f.id} returned no units`);
  for (const u of list) units.push({ name: u.Name, code: String(u.Name).split("#").pop().trim(), loop: f.loop });
}

// --- Campsite points: State Parks. ---
const where = `UNIT_NBR=${Number(spec.unit)} AND CampgroundName LIKE '${spec.campgroundLike.replace(/'/g, "''")}'`;
const q = new URLSearchParams({ where, outFields: "SITE_NBR,SITE_TYPE,PARKING_LENGTH_FT,PARKING_WIDTH_FT,CampgroundName,last_edited_date", outSR: "4326", f: "geojson" });
const cspJson = JSON.parse(await getText(`${CSP}/query?${q}`));
if (!Array.isArray(cspJson.features)) throw new Error(`State Parks campsites: ${JSON.stringify(cspJson.error ?? cspJson).slice(0, 200)}`);
const cspAll = cspJson.features.filter((f) => f.geometry);
// Match each RC unit to State Parks' point of the same kind and number (match.mjs, tested).
const { matched, notFound, dupes, skipped } = matchUnits(units, cspAll);
if (!matched.length) throw new Error("no RC unit matched a State Parks point");
const csp = matched.map((m) => m.f);
const geo = makeGeo(csp.map((f) => f.geometry.coordinates));
const { xy, frame, bboxArr, inFrame, pathOf, labelFor, spaced } = geo;

// --- Roads, paths, restrooms, water, parking: OpenStreetMap (ODbL). ---
const osmXml = await getText(`https://api.openstreetmap.org/api/0.6/map?bbox=${bboxArr.map((v) => v.toFixed(6)).join(",")}`);
if (!osmXml.includes("<osm")) throw new Error("OpenStreetMap answered without map data");
const nodes = new Map(), ways = [];
for (const m of osmXml.matchAll(/<node id="(\d+)"[^>]*?lat="([-0-9.]+)" lon="([-0-9.]+)"[^>]*?(\/>|>([\s\S]*?)<\/node>)/g)) {
  nodes.set(m[1], { at: [Number(m[3]), Number(m[2])], tags: Object.fromEntries([...(m[5] ?? "").matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)].map((t) => [t[1], t[2]])) });
}
for (const m of osmXml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
  const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((r) => r[1]).filter((r) => nodes.has(r));
  ways.push({ coords: refs.map((r) => nodes.get(r).at), tags: Object.fromEntries([...m[2].matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)].map((t) => [t[1], t[2]])) });
}
const asLine = (w) => ({ type: "Feature", properties: w.tags, geometry: { type: "LineString", coordinates: w.coords } });
const ROADS = new Set(["service", "residential", "unclassified", "tertiary", "secondary", "primary", "trunk", "track"]);
const roadWays = ways.filter((w) => ROADS.has(w.tags.highway) && w.tags.service !== "driveway").map(asLine);
const trailWays = ways.filter((w) => ["footway", "path", "cycleway", "bridleway"].includes(w.tags.highway)).map(asLine);
const closed = (w) => w.coords.length > 3 && w.coords[0][0] === w.coords.at(-1)[0] && w.coords[0][1] === w.coords.at(-1)[1];
const centroid = (cs) => [cs.reduce((a, c) => a + c[0], 0) / cs.length, cs.reduce((a, c) => a + c[1], 0) / cs.length];
const POI = { toilets: "Restroom", drinking_water: "Water", water_point: "Water", sanitary_dump_station: "Dump Station", shower: "Showers" };
const pois = [
  ...[...nodes.values()].filter((n) => POI[n.tags.amenity]).map((n) => ({ type: POI[n.tags.amenity], name: n.tags.name ?? "", at: xy(n.at) })),
  ...ways.filter((w) => POI[w.tags.amenity] && w.coords.length).map((w) => ({ type: POI[w.tags.amenity], name: w.tags.name ?? "", at: xy(centroid(w.coords)) })),
].filter((p) => inFrame(p.at));

// --- River: USGS hydrography. ---
const [waterAreas, flowlines] = await Promise.all([
  arcgis(`${NHD}/9`, geo.bbox, "FTYPE,FCODE"),
  arcgis(`${NHD}/6`, geo.bbox, "gnis_name,fcode"),
]);

if (!roadWays.some((f) => f.properties.highway === "service")) throw new Error("no campground roads in OpenStreetMap for this frame; not drawing a map without them");
const awayFromRoad = geo.awayFromRoad(roadWays.filter((f) => f.properties.highway === "service"));
const roadLabel = (f) => f.properties.name;
const labels = spaced([
  ...named(roadWays.filter((f) => f.properties.highway !== "service"), "name").map((n) => labelFor(n, "road", roadWays.filter((f) => roadLabel(f) === n))),
  ...named(trailWays, "name").map((n) => labelFor(n, "trail", trailWays.filter((f) => f.properties.name === n))),
  ...named(flowlines, "gnis_name").map((n) => labelFor(n, "water", flowlines.filter((f) => f.properties.gnis_name === n))),
]);

const out = {
  facilityId: `csp-${spec.key}`,
  source: { ridbExport: "", built: new Date().toISOString().slice(0, 10) },
  credits: "Drawn by CampHawk. Campsite locations: California State Parks. Roads, restrooms and water: © OpenStreetMap contributors. River: USGS. Positions are approximate. Check the booking site before you go.",
  pending: "California State Parks' permission (requested)",
  review: { duplicateNumbers: dupes, notInStateParksData: notFound, notDrawnKinds: skipped },
  frame,
  labels,
  roads: kept(roadWays.map((f) => ({ name: f.properties.name ?? "", cls: f.properties.highway === "service" ? "Service" : "Local", oneWay: f.properties.oneway ?? "", d: pathOf(lines(f.geometry), false) }))),
  trails: kept(trailWays.map((f) => ({ name: f.properties.name ?? "", d: pathOf(lines(f.geometry), false) }))),
  lots: kept(ways.filter((w) => w.tags.amenity === "parking" && closed(w)).map((w) => ({ d: pathOf([w.coords], true) }))),
  water: kept(waterAreas.map((f) => ({ fcode: f.properties.FCODE ?? f.properties.fcode, d: pathOf(rings(f.geometry), true) }))),
  buildings: kept(ways.filter((w) => w.tags.building && closed(w)).map((w) => ({ name: w.tags.name ?? "", type: w.tags.amenity === "toilets" ? "Restroom" : (w.tags.building ?? ""), d: pathOf([w.coords], true) }))),
  pois,
  sites: matched
    .map(({ unit, f }) => {
      const p = f.properties, at = xy(f.geometry.coordinates);
      const ft = (v) => (Number(v) > 0 ? Number(v) : undefined);
      return { name: unit.code, loop: unit.loop, type: typeOf(p.SITE_TYPE), at, out: awayFromRoad(at), accessible: false, spurFt: ft(p.PARKING_LENGTH_FT), spurWidthFt: ft(p.PARKING_WIDTH_FT) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true })),
};
mkdirSync(OUT, { recursive: true });
const file = join(OUT, `csp-${spec.key}.json`);
writeFileSync(file, JSON.stringify(out) + "\n");
console.log(`${file}\n  ${matched.length} of ${units.length} RC units drawn`);
console.log(`  no State Parks point: ${notFound.join(", ") || "none"}\n  two points (left off for review): ${dupes.join(", ") || "none"}\n  kinds not drawn: ${skipped.join(", ") || "none"}`);
console.log(`  ${out.roads.length} road parts, ${out.trails.length} trails, ${out.water.length} water, ${out.pois.length} points (${[...new Set(pois.map((p) => p.type))].join(", ")}), ${out.labels.length} labels`);
console.log(`  frame ${frame.w} x ${frame.h} m`);
