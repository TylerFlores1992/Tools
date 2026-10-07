// Builds a Recreation.gov campground's site map from free public data into a small JSON the lab
// draws as SVG, and runs the automatic check (qa.mjs) on it.
//
//   node studio/campground-maps/build.mjs <ridb-dir> [facility-id]      (default 232447, Upper Pines)
//
// <ridb-dir> holds the unzipped RIDB full export (Facilities, Campsites, CampsiteAttributes CSVs),
// downloaded with no key from https://ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip
// (248 MB; not committed). Everything else is fetched live (and cached in .cache/). Sources and
// licences: README.md. build-sample.mjs builds the 50-campground sample with the same function.
//
// The output is in metres on a local flat projection (north up), rounded to 0.1 m. Nothing here
// is traced from anyone's map picture. Site points are Recreation.gov's published coordinates.
// Every other layer comes from the best source that has it, one source per layer, never merged
// (two sources' copies of one road would draw it twice, a few metres apart):
//   roads, trails, parking, buildings: the Park Service's GIS where it has roads in the frame,
//     else OpenStreetMap, else the Forest Service's system roads, else none (and QA says so);
//   restrooms, water taps, dump stations: per kind, the Park Service's where it has that kind,
//     else OpenStreetMap's;
//   lakes and rivers: USGS hydrography.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { csvObjects } from "./ridb.mjs";
import { NHD, arcgis, kept, lines, makeGeo, rings } from "./geo.mjs";
import { fetchOsm, fetchWaterRelation, osmLayers } from "./osm.mjs";
import { checkMap } from "./qa.mjs";

const NPS = "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets";
const USFS_ROADS = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_RoadBasic_01/MapServer/0";
export const AGENCY = { 126: "Bureau of Land Management", 127: "Fish and Wildlife Service", 128: "National Park Service", 129: "Bureau of Reclamation", 130: "US Army Corps of Engineers", 131: "Forest Service", 260: "Navy" };
/** Past this the sites aren't one campground (a trail's camps, a dispersed area): no layers fetched. */
const MAX_FRAME_M = 5000;

/** The parts of the RIDB export a build needs, for the given facility ids. */
export function loadRidb(ridbDir, ids) {
  const want = new Set(ids);
  const facilities = new Map(), sites = new Map(), attrs = new Map();
  for (const f of csvObjects(join(ridbDir, "Facilities_API_v1.csv"))) if (want.has(f.FacilityID)) facilities.set(f.FacilityID, f);
  const siteIds = new Set();
  for (const r of csvObjects(join(ridbDir, "Campsites_API_v1.csv"))) {
    if (!want.has(r.FacilityID)) continue;
    (sites.get(r.FacilityID) ?? sites.set(r.FacilityID, []).get(r.FacilityID)).push(r);
    siteIds.add(r.CampsiteID);
  }
  for (const r of csvObjects(join(ridbDir, "CampsiteAttributes_API_v1.csv"))) {
    if (!siteIds.has(r.EntityID)) continue;
    (attrs.get(r.EntityID) ?? attrs.set(r.EntityID, {}).get(r.EntityID))[r.AttributeName] = r.AttributeValue;
  }
  return { facilities, sites, attrs };
}

/** Bookable overnight sites: staff (management) and day-use sites are never drawn. */
export const bookable = (r) => r.CampsiteType !== "MANAGEMENT" && r.TypeOfUse === "Overnight";

const segmentsOf = (features, xy) => features.flatMap((f) => lines(f.geometry).flatMap((p) => { const m = p.map(xy); return m.slice(1).map((b, i) => [m[i], b]); }));

/** Build one campground's map. Returns { map, qa }; throws if a source fails (never a silent gap). */
export async function buildRidbMap(ridb, facilityId, meta = {}) {
  const fac = ridb.facilities.get(facilityId);
  const rows = (ridb.sites.get(facilityId) ?? []).filter(bookable);
  if (!rows.length) throw new Error(`no bookable overnight campsites for facility ${facilityId}`);
  const sites = rows.map((r) => ({ ridbId: r.CampsiteID, name: r.CampsiteName.trim(), type: r.CampsiteType, accessible: r.CampsiteAccessible === "true", lat: Number(r.CampsiteLatitude) || 0, lon: Number(r.CampsiteLongitude) || 0 }));
  const placed = sites.filter((s) => s.lat && s.lon);
  if (!placed.length) throw new Error(`facility ${facilityId} has no site points`);

  const geo = makeGeo(placed.map((s) => [s.lon, s.lat]));
  const { xy, frame, bbox, bboxArr, inFrame, pathOf, labelFor, spaced } = geo;
  const huge = Math.max(frame.w, frame.h) > MAX_FRAME_M;
  const none = [];

  // --- Layers, each from one source. ---
  const [npsRoads, npsPois, npsBuildings, npsLots, npsTrails] = huge ? [none, none, none, none, none] : await Promise.all([
    arcgis(`${NPS}/NPS_Public_Roads_Geographic/FeatureServer/0`, bbox, "RDNAME,RDCLASS,RDONEWAY,RDSTATUS,PUBLICDISPLAY"),
    arcgis(`${NPS}/NPS_Public_POIs_Geographic/FeatureServer/0`, bbox, "POINAME,POITYPE,PUBLICDISPLAY"),
    arcgis(`${NPS}/NPS_Public_Buildings_Geographic/FeatureServer/0`, bbox, "BLDGNAME,BLDGTYPE,PUBLICDISPLAY"),
    arcgis(`${NPS}/NPS_Public_ParkingLots_Geographic/FeatureServer/0`, bbox, "LOTNAME,PUBLICDISPLAY"),
    arcgis(`${NPS}/NPS_Public_Trails_Geographic/FeatureServer/0`, bbox, "TRLNAME,TRLCLASS,TRLUSE,PUBLICDISPLAY"),
  ]);
  const osm = huge ? null : osmLayers(await fetchOsm(bboxArr));

  // Water: USGS hydrography, or, when USGS doesn't answer, OpenStreetMap's (which is often
  // NHD's own outlines, imported). One source per map, recorded in `sources.water`.
  let waterSource = "none", waterParts = [], flowlines = [];
  if (!huge) {
    try {
      const [areas, bodies, lines6] = await Promise.all([
        arcgis(`${NHD}/9`, bbox, "FTYPE,FCODE", "1=1", {}, 2),
        // Lakes and reservoirs (most Army Corps campgrounds sit on one). Generalised to ~2 m: a
        // reservoir's whole shoreline comes back, and it is clipped to the frame afterwards.
        arcgis(`${NHD}/12`, bbox, "FTYPE,FCODE,gnis_name", "1=1", { maxAllowableOffset: "0.00002" }, 2),
        arcgis(`${NHD}/6`, bbox, "gnis_name,fcode", "1=1", {}, 2),
      ]);
      waterSource = "usgs";
      waterParts = [...areas, ...bodies].map((f) => ({ fcode: f.properties.FCODE ?? f.properties.fcode, parts: rings(f.geometry) }));
      flowlines = lines6.map((f) => ({ name: f.properties.gnis_name ?? "", f }));
    } catch (e) {
      console.warn(`  USGS water didn't answer (${String(e.message).slice(0, 80)}); using OpenStreetMap's`);
      waterSource = "osm";
      const relRings = [];
      for (const id of osm.waterRelations) relRings.push(await fetchWaterRelation(id));
      waterParts = [...osm.water.map((r) => [r]), ...relRings.filter((r) => r.length)].map((parts) => ({ fcode: 0, parts }));
      flowlines = osm.waterways.map((f) => ({ name: f.properties.name ?? "", f }));
    }
  }


  let roadSource = "none", roads = [], trails = [], lots = [], buildings = [];
  if (npsRoads.length) {
    roadSource = "nps";
    roads = npsRoads.map((f) => ({ f, name: f.properties.RDNAME ?? "", cls: f.properties.RDCLASS ?? "", oneWay: f.properties.RDONEWAY ?? "" }));
    trails = npsTrails.map((f) => ({ f, name: f.properties.TRLNAME ?? "" }));
    lots = npsLots.map((f) => rings(f.geometry));
    buildings = npsBuildings.map((f) => ({ name: f.properties.BLDGNAME ?? "", type: f.properties.BLDGTYPE ?? "", parts: rings(f.geometry) }));
  } else if (osm && osm.roads.length) {
    roadSource = "osm";
    roads = osm.roads.map((f) => ({ f, name: f.properties.name ?? f.properties.ref ?? "", cls: ["service", "track"].includes(f.properties.highway) ? "Service" : "Local", oneWay: f.properties.oneway ?? "" }));
  } else if (!huge) {
    const fs = await arcgis(USFS_ROADS, bbox, "ID,NAME,OPER_MAINT_LEVEL");
    if (fs.length) { roadSource = "usfs"; roads = fs.map((f) => ({ f, name: f.properties.NAME ?? "", cls: "Service", oneWay: "" })); }
  }
  if (roadSource !== "nps" && osm) {
    trails = osm.trails.map((f) => ({ f, name: f.properties.name ?? "" }));
    lots = osm.lots.map((ring) => [ring]);
    buildings = osm.buildings.map((b) => ({ name: b.name, type: b.type, parts: [b.ring] }));
  }

  // Service points, per kind: the Park Service's where it has that kind, else OpenStreetMap's.
  const npsPoints = npsPois.filter((f) => f.geometry?.type === "Point").map((f) => ({ name: f.properties.POINAME ?? "", type: f.properties.POITYPE ?? "", at: f.geometry.coordinates, src: "nps" }));
  const kinds = new Set(npsPoints.map((p) => p.type));
  const osmPoints = (osm?.pois ?? []).filter((p) => !kinds.has(p.type)).map((p) => ({ ...p, src: "osm" }));
  const pois = [...npsPoints, ...osmPoints].map((p) => ({ name: p.name, type: p.type, at: xy(p.at), src: p.src })).filter((p) => inFrame(p.at));

  // --- Sites ---
  const awayFromRoad = geo.awayFromRoad(roads.filter((r) => r.cls === "Service").map((r) => r.f).concat(roads.some((r) => r.cls === "Service") ? [] : roads.map((r) => r.f)));
  const outSites = sites
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((s) => {
      const a = ridb.attrs.get(s.ridbId) ?? {};
      const num = (k) => (Number(a[k]) > 0 ? Number(a[k]) : undefined); // RIDB writes 0 for "not recorded"
      const at = s.lat && s.lon ? xy([s.lon, s.lat]) : null;
      return {
        name: s.name,
        type: s.type,
        at,
        out: at ? awayFromRoad(at) : undefined,
        accessible: s.accessible || a.Accessibility === "Y",
        maxVehicleFt: num("Max Vehicle Length"),
        maxPeople: num("Max Num of People"),
        backIn: /back-?in/i.test(a["Driveway Entry"] ?? "") || undefined,
        shade: a.Shade === "Yes" || undefined,
      };
    });

  const labels = spaced([
    ...[...new Set(roads.filter((r) => r.cls !== "Service").map((r) => r.name).filter(Boolean))].map((n) => labelFor(n, "road", roads.filter((r) => r.name === n).map((r) => r.f))),
    ...[...new Set(trails.map((t) => t.name).filter(Boolean))].filter((n) => !roads.some((r) => r.name === n)).sort((a, b) => Number(/bike path/i.test(a)) - Number(/bike path/i.test(b))).map((n) => labelFor(n, "trail", trails.filter((t) => t.name === n).map((t) => t.f))),
    ...[...new Set(flowlines.map((l) => l.name).filter(Boolean))].map((n) => labelFor(n, "water", flowlines.filter((l) => l.name === n).map((l) => l.f))),
  ]);

  // --- Automatic check ---
  const toM = (ring) => ring.map(xy);
  const qa = checkMap({
    sites: outSites.map((s) => ({ name: s.name, at: s.at })),
    roadSegments: segmentsOf(roads.map((r) => r.f), xy),
    roadSource,
    outlineRings: (osm?.outlines ?? []).flatMap((o) => o.rings.map(toM)),
    pitches: (osm?.pitches ?? []).map((p) => ({ ref: p.ref, at: xy(p.at) })),
  });

  // The credit line names each layer's source, so a reader can tell what came from where.
  const SRC = { nps: "National Park Service", osm: "OpenStreetMap", usfs: "Forest Service", usgs: "USGS" };
  const poiSrc = [...new Set(pois.map((p) => p.src))];
  const credit = [
    "Drawn by CampHawk. Sites: Recreation.gov (RIDB, CC BY 4.0).",
    roads.length && `Roads: ${SRC[roadSource]}.`,
    poiSrc.length && `Restrooms and water: ${poiSrc.map((k) => SRC[k]).join(" and ")}.`,
    (waterParts.length || flowlines.length) && `Lakes and rivers: ${SRC[waterSource]}.`,
  ].filter(Boolean);
  const usedOsm = roadSource === "osm" || poiSrc.includes("osm") || (waterSource === "osm" && (waterParts.length || flowlines.length)) || (roadSource !== "nps" && (trails.length || lots.length || buildings.length));
  if (usedOsm) credit.push("Map data © OpenStreetMap contributors.");
  credit.push("Positions are approximate. Check the booking site before you go.");
  const credits = credit.join(" ");

  const map = {
    facilityId,
    name: fac?.FacilityName?.trim() ?? meta.name ?? "",
    agency: AGENCY[fac?.OrgFacilityID] ?? meta.agency ?? "",
    ...(meta.state ? { state: meta.state } : {}),
    ...(meta.recArea ? { recArea: meta.recArea } : {}),
    source: { ridbExport: "RIDB full export (CSV), Recreation.gov, CC BY 4.0", built: new Date().toISOString().slice(0, 10) },
    sources: { roads: roadSource, water: waterSource, osm: Boolean(usedOsm) },
    credits,
    frame,
    /** The frame in degrees [west, south, east, north], to ask for the aerial photo under it. */
    bbox: bboxArr.map((v) => Math.round(v * 1e6) / 1e6),
    labels,
    roads: kept(roads.map((r) => ({ name: r.name, cls: r.cls, oneWay: r.oneWay, d: pathOf(lines(r.f.geometry), false) }))),
    trails: kept(trails.map((t) => ({ name: t.name, d: pathOf(lines(t.f.geometry), false) }))),
    lots: kept(lots.map((parts) => ({ d: pathOf(parts, true) }))),
    water: kept(waterParts.map((w) => ({ fcode: w.fcode, d: pathOf(w.parts, true) }))),
    buildings: kept(buildings.map((b) => ({ name: b.name, type: b.type, d: pathOf(b.parts, true) }))),
    pois: pois.map((p) => ({ name: p.name, type: p.type, at: p.at })),
    sites: outSites,
    /** What the checks compared against, kept so a reviewer sees it on the aerial photo. */
    evidence: {
      outline: (osm?.outlines ?? []).map((o) => pathOf(o.rings, true)).filter(Boolean).join(""),
      pitches: (osm?.pitches ?? []).map((p) => ({ ref: p.ref, at: xy(p.at) })).filter((p) => inFrame(p.at)),
    },
    qa,
  };
  return { map, qa };
}

// --- CLI: one campground into the lab's bundled maps (Upper Pines). ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const [ridbDir, facilityId = "232447"] = process.argv.slice(2);
  if (!ridbDir) { console.error("usage: build.mjs <ridb-dir> [facility-id]"); process.exit(1); }
  const ridb = loadRidb(ridbDir, [facilityId]);
  const { map, qa } = await buildRidbMap(ridb, facilityId);
  const OUT = join(import.meta.dirname, "../../src/lab/camphawk/round2/maps");
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `ridb-${facilityId}.json`);
  writeFileSync(file, JSON.stringify(map) + "\n");
  console.log(`${file}\n  ${map.sites.length} bookable sites, ${qa.metrics.unplaced.length} without a point`);
  console.log(`  roads: ${map.sources.roads} (${map.roads.length} parts), ${map.trails.length} trails, ${map.lots.length} lots, ${map.water.length} water, ${map.buildings.length} buildings, ${map.pois.length} points`);
  console.log(`  frame ${frame(map)}; QA ${qa.verdict}${qa.reasons.length ? ": " + qa.reasons.map((r) => r.text).join("; ") : ""}`);
}
function frame(map) { return `${map.frame.w} x ${map.frame.h} m`; }
