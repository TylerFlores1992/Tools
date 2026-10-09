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
//   roads: the source whose roads the sites sit along (roads.mjs): the Park Service's GIS,
//     OpenStreetMap, the Forest Service's system roads or the Census Bureau's TIGER roads;
//   trails, parking, buildings: the Park Service's when its roads were picked, else OpenStreetMap's;
//   restrooms, water taps, dump stations: per kind, the Park Service's where it has that kind,
//     else OpenStreetMap's;
//   lakes and rivers: USGS hydrography, else OpenStreetMap's.
// Then what a person traced from the aerial photo, where no source has it (trace.mjs), on top.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { csvObjects } from "./ridb.mjs";
import { NHD, arcgis, kept, lines, makeGeo, rings } from "./geo.mjs";
import { fetchOsm, fetchWaterRelation, osmLayers, osmSource } from "./osm.mjs";
import { checkAreas, checkDispersed, checkFirstCome, checkMap, checkUnit } from "./qa.mjs";
import { factsFromLoaded, isFirstComeSites } from "./first-come.mjs";
import { splitAreas } from "../../src/lab/camphawk/round2/maps/areas.ts";
import { pickRoadSource, roadFit } from "./roads.mjs";
import { applySiteMoves, readTrace } from "./trace.mjs";
import { poiKind } from "./pois.mjs";

const NPS = "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets";
const USFS_ROADS = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_RoadBasic_01/MapServer/0";
/** Census TIGER roads (public domain): primary, secondary and local roads. */
const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer";
/** TIGER's feature classes that are a through road; the rest (4WD trails, service drives, parking
    lot roads, private roads, unnamed local roads) are campground roads, drawn thin. */
const TIGER_THROUGH = new Set(["S1100", "S1200"]);
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

/** A single unit (one cabin, lookout, guard station or group site) gets a location map: this much
    ground around it (m), so the road in, the water and the trailheads near it show. A campground's
    sites are framed tightly (geo.mjs's 55 m). Playbook §5.1. */
export const SINGLE_UNIT_PAD_M = 700;
/**
 * Listings a reviewer called split or not split (splits.json), overriding the automatic rule
 * (areas.ts ONE_MAP_SPAN_M, 1.5 km): split → areas even when the sites fit; not split → one map
 * (one the owner approved as a single map stays one). A call, not a measurement; each entry says
 * who made it and why.
 */
export function splitCalls(file = join(import.meta.dirname, "splits.json"), dir = join(import.meta.dirname, "splits")) {
  // splits.json, plus one file a wave in splits/ (a rollout child writes its wave's calls there,
  // so parallel waves never edit one file). Same shape: { version, about, listings: [...] }.
  const files = [file, ...(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => join(dir, f)) : [])].filter((f) => existsSync(f));
  return new Map(files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")).listings.map((l) => [l.id, l])));
}
const SPLIT_CALLS = splitCalls();

/**
 * How a camper sees a listing: one unit (a location map), one campground map, areas, or dispersed.
 * A reviewer's call overrides the 1.5 km rule either way.
 */
export function viewOf(sites, call) {
  // A first-come campground booked as one "Standard" site is a campground, not a unit
  // (docs/design/campground-maps-first-come.md; the owner picked its look, 2026-10-08).
  if (isFirstComeSites(sites.map((s) => s.name))) return { kind: "firstcome" };
  if (sites.length === 1) return { kind: "unit" };
  // A split call may also set how tight the areas are, read off the photo: `gap` (m between areas)
  // or `maxSpan` (m across one area), when the defaults put several clusters in one area.
  return splitAreas(sites, call ? { oneMap: call.split ? 0 : Infinity, ...(call.gap ? { gap: call.gap } : {}), ...(call.maxSpan ? { maxSpan: call.maxSpan } : {}) } : {});
}

export const padFor = (placedSites) => (placedSites === 1 ? SINGLE_UNIT_PAD_M : undefined);

/** Bookable overnight sites: staff (management) and day-use sites are never drawn. */
/** Bookable overnight sites: staff (management), day-use and parking rows (BLM lists an "Extra
    Vehicle" at every site's own spot) are never drawn. */
export const bookable = (r) => r.CampsiteType !== "MANAGEMENT" && r.CampsiteType !== "PARKING" && r.TypeOfUse === "Overnight";

/** A point this far from every other site is a bad point, not a site: the build leaves it off. */
export const STRAY_M = 2000;
/**
 * The sites whose point is STRAY_M or more from every other site's (RIDB has points 1,300 km off,
 * in the wrong state): at most two, and only when five or more sites are left, so a listing that
 * really is spread out (dispersed, boat-in) is never pruned. Each with how far it is (m).
 * Pure: sites are { name, lat, lon } (0, 0 for no point).
 */
export function strayPoints(sites) {
  const placed = sites.map((s, i) => ({ ...s, i })).filter((s) => s.lat && s.lon);
  const m = (a, b) => Math.hypot((a.lon - b.lon) * 111320 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180), (a.lat - b.lat) * 110540);
  // By position, not name: a listing can reuse a site's name (two loops' "12").
  const far = placed.map((s) => ({ i: s.i, name: s.name, m: Math.min(...placed.filter((o) => o !== s).map((o) => m(s, o))) })).filter((s) => s.m >= STRAY_M);
  return far.length && far.length <= 2 && placed.length - far.length >= 5 ? far : [];
}

/** The sites with stray points taken off the map: no point, and `strayM` to say why. */
export function withoutStrays(sites) {
  const stray = new Map(strayPoints(sites).map((s) => [s.i, s.m]));
  return sites.map((s, i) => (stray.has(i) ? { ...s, lat: 0, lon: 0, strayM: Math.round(stray.get(i) / 100) * 100 } : s));
}

const segmentsOf = (features, xy) => features.flatMap((f) => lines(f.geometry).flatMap((p) => { const m = p.map(xy); return m.slice(1).map((b, i) => [m[i], b]); }));

/** The box a campground's map asks map services for ([w, s, e, n]), and whether it is too big to
    be one campground (MAX_FRAME_M): the same frame buildRidbMap() fits, so a wave can cut all its
    OpenStreetMap boxes in one pass first (osm.mjs prefetchOsm). Null when no site has a point. */
export function frameBoxOf(ridb, facilityId) {
  // Sites a person moved count where they were moved to (trace.mjs), as in buildRidbMap().
  const sites = withoutStrays(applySiteMoves((ridb.sites.get(facilityId) ?? []).filter(bookable).map((r) => ({ name: r.CampsiteName.trim(), lat: Number(r.CampsiteLatitude) || 0, lon: Number(r.CampsiteLongitude) || 0 })), readTrace(`ridb-${facilityId}`, null)?.sites));
  const placed = sites.filter((s) => s.lat && s.lon);
  if (!placed.length) return null;
  const { frame, bboxArr } = makeGeo(placed.map((s) => [s.lon, s.lat]), padFor(placed.length));
  return { bboxArr, huge: Math.max(frame.w, frame.h) > MAX_FRAME_M };
}

/** What a trace was drawn over, for the credits, from its `photo`: "aerial photos", "lidar
    elevation (USGS 3DEP)" (the elevation service's relief), "lidar (USGS 3DEP)" (the point clouds,
    pointcloud/ground.py: the points themselves, not only the elevation), or photos and one of them.
    Public domain all; the trace file names each in full. */
export function tracedOver(photo = "") {
  const usgs = /3DEP|USGS 3D Elevation/i.test(photo), dogami = /DOGAMI/i.test(photo);
  const who = [usgs && "USGS 3DEP", dogami && "Oregon DOGAMI"].filter(Boolean).join(" and ");
  const points = /point cloud/i.test(photo);
  const photos = /NAIP|Forest Service|USDA|photo/i.test(photo.replace(/lidar[^;]*/gi, "")) || !who;
  return [photos && "aerial photos", who && `${points ? "lidar" : "lidar elevation"} (${who})`].filter(Boolean).join(" and ");
}

/** The outlines as the map keeps them: one path of every ring, and each ring's OpenStreetMap
    name in the same order (a ring the frame clips away drops out of both). */
export function outlineEvidence(outlines, pathOf) {
  const kept = outlines.flatMap((o) => o.rings.map((r) => ({ d: pathOf([r], true), name: o.name ?? "" }))).filter((r) => r.d);
  return { outline: kept.map((r) => r.d).join(""), outlineNames: kept.map((r) => r.name) };
}

/** Build one campground's map. Returns { map, qa }; throws if a source fails (never a silent gap). */
export async function buildRidbMap(ridb, facilityId, meta = {}) {
  const fac = ridb.facilities.get(facilityId);
  const rows = (ridb.sites.get(facilityId) ?? []).filter(bookable);
  if (!rows.length) throw new Error(`no bookable overnight campsites for facility ${facilityId}`);
  // Sites a person moved to where the aerial photo shows them (a trace's `sites`), before the map is
  // framed: a stray point's frame would be kilometres wide.
  // A point kilometres from every other site is left off (withoutStrays), after any move: a person
  // may have moved it back.
  const sites = withoutStrays(applySiteMoves(rows.map((r) => ({ ridbId: r.CampsiteID, name: r.CampsiteName.trim(), type: r.CampsiteType, accessible: r.CampsiteAccessible === "true", lat: Number(r.CampsiteLatitude) || 0, lon: Number(r.CampsiteLongitude) || 0 })), readTrace(`ridb-${facilityId}`, null)?.sites));
  const moved = sites.filter((s) => s.movedFrom !== undefined).length;
  const placed = sites.filter((s) => s.lat && s.lon);
  if (!placed.length) throw new Error(`facility ${facilityId} has no site points`);

  const geo = makeGeo(placed.map((s) => [s.lon, s.lat]), padFor(placed.length));
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
  // OSM from a regional extract when one covers the frame, else the API (osm.mjs). `meta.osm`
  // "extract" makes a missing extract an error, so a wave is never read half one way.
  const osmFrom = huge ? null : osmSource(bboxArr, meta.osm ?? process.env.OSM_FROM ?? "auto");
  const osm = huge ? null : osmLayers(await fetchOsm(bboxArr, osmFrom));

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
      for (const id of osm.waterRelations) relRings.push(await fetchWaterRelation(id, osmFrom));
      waterParts = [...osm.water.map((r) => [r]), ...relRings.filter((r) => r.length)].map((parts) => ({ fcode: 0, parts }));
      flowlines = osm.waterways.map((f) => ({ name: f.properties.name ?? "", f }));
    }
  }


  // Roads: every source's roads in the frame, then the one the sites sit along (roads.mjs).
  const [usfsRoads, tigerRoads] = huge ? [none, none] : await Promise.all([
    arcgis(USFS_ROADS, bbox, "ID,NAME,OPER_MAINT_LEVEL"),
    Promise.all([2, 6, 8].map((l) => arcgis(`${TIGER}/${l}`, bbox, "NAME,MTFCC"))).then((ls) => ls.flat()),
  ]);
  const candidates = {
    nps: npsRoads.map((f) => ({ f, name: f.properties.RDNAME ?? "", cls: f.properties.RDCLASS ?? "", oneWay: f.properties.RDONEWAY ?? "" })),
    osm: (osm?.roads ?? []).map((f) => ({ f, name: f.properties.name ?? f.properties.ref ?? "", cls: ["service", "track"].includes(f.properties.highway) ? "Service" : "Local", oneWay: f.properties.oneway ?? "" })),
    usfs: usfsRoads.map((f) => ({ f, name: f.properties.NAME ?? "", cls: "Service", oneWay: "" })),
    tiger: tigerRoads.map((f) => ({ f, name: f.properties.NAME ?? "", cls: TIGER_THROUGH.has(f.properties.MTFCC) || (f.properties.MTFCC === "S1400" && f.properties.NAME) ? "Local" : "Service", oneWay: "" })),
  };
  const sitePts = sites.filter((s) => s.lat && s.lon).map((s) => xy([s.lon, s.lat]));
  const roadFits = Object.fromEntries(Object.entries(candidates).map(([k, rs]) => [k, roadFit(sitePts, segmentsOf(rs.map((r) => r.f), xy))]));
  const picked = pickRoadSource(roadFits);
  const roadSource = picked.source;
  let roads = roadSource === "none" ? [] : candidates[roadSource], trails = [], lots = [], buildings = [];
  if (roadSource === "nps") {
    trails = npsTrails.map((f) => ({ f, name: f.properties.TRLNAME ?? "" }));
    lots = npsLots.map((f) => rings(f.geometry));
    buildings = npsBuildings.map((f) => ({ name: f.properties.BLDGNAME ?? "", type: f.properties.BLDGTYPE ?? "", parts: rings(f.geometry) }));
  } else if (osm) {
    trails = osm.trails.map((f) => ({ f, name: f.properties.name ?? "" }));
    lots = osm.lots.map((ring) => [ring]);
    buildings = osm.buildings.map((b) => ({ name: b.name, type: b.type, parts: [b.ring] }));
  }

  // What a person traced from the aerial photo, where no source has it: campground roads, and
  // restrooms and water taps they could see. Drawn like any other campground road.
  const trace = readTrace(`ridb-${facilityId}`, bboxArr);
  const traced = (trace?.roads ?? []).map((r) => ({ f: { geometry: { type: "LineString", coordinates: r.coords } }, name: r.name?.trim() ?? "", cls: r.through ? "Local" : "Service", oneWay: "", traced: true }));
  // A trace that replaces the roads is the whole road layer (trace.mjs).
  const replaced = trace?.replace === true;
  roads = replaced ? traced : [...roads, ...traced];

  // Service points, per kind: the Park Service's where it has that kind, else OpenStreetMap's.
  // Only the kinds the map draws, under its names (pois.mjs): the Park Service's layer also holds
  // campsite markers, food lockers, hookups and the like.
  const npsPoints = npsPois.filter((f) => f.geometry?.type === "Point" && poiKind(f.properties.POITYPE)).map((f) => ({ name: f.properties.POINAME ?? "", type: poiKind(f.properties.POITYPE), at: f.geometry.coordinates, src: "nps" }));
  const kinds = new Set(npsPoints.map((p) => p.type));
  const osmPoints = (osm?.pois ?? []).filter((p) => poiKind(p.type) && !kinds.has(poiKind(p.type))).map((p) => ({ ...p, type: poiKind(p.type), src: "osm" }));
  const tracedPoints = (trace?.points ?? []).map((p) => ({ name: "", type: p.type, at: p.at, src: "traced" }));
  const pois = [...npsPoints, ...osmPoints, ...tracedPoints].map((p) => ({ name: p.name, type: p.type, at: xy(p.at), src: p.src })).filter((p) => inFrame(p.at));

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
        ...(s.movedFrom !== undefined ? { movedFrom: s.movedFrom ? xy(s.movedFrom) : null } : {}),
        ...(s.strayM ? { strayM: s.strayM } : {}),
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
  const checkInput = {
    sites: outSites.map((s) => ({ name: s.name, at: s.at, ...(s.strayM ? { strayM: s.strayM } : {}) })),
    roadSegments: segmentsOf(roads.map((r) => r.f), xy),
    roadSource: (roadSource === "none" || replaced) && traced.length ? "traced" : roadSource,
    traced: { roads: traced.length, points: tracedPoints.length, sites: moved },
    outlineRings: (osm?.outlines ?? []).flatMap((o) => o.rings.map(toM)),
    outlines: (osm?.outlines ?? []).flatMap((o) => o.rings.map((r) => ({ ring: toM(r), name: o.name ?? "" }))),
    pitches: (osm?.pitches ?? []).map((p) => ({ ref: p.ref, at: xy(p.at) })),
  };
  // One unit is a place (a location map and its own check); a listing of several places is shown,
  // and checked, area by area (areas.ts, qa.mjs). Anything else is one campground map.
  let qa = checkMap(checkInput), split = null, firstCome = null;
  const call = meta.split ?? SPLIT_CALLS.get(facilityId);
  const view = viewOf(outSites, call);
  if (view.kind === "firstcome") {
    const standard = rows.find((r) => r.CampsiteName.trim().toLowerCase() === "standard");
    firstCome = factsFromLoaded(facilityId, fac ?? { FacilityName: meta.name ?? "", FacilityDescription: "" }, standard ? ridb.attrs?.get(standard.CampsiteID) : {});
    qa = checkFirstCome({ site: checkInput.sites[0], outlines: checkInput.outlines, name: firstCome.name, closed: firstCome.closed, traced: checkInput.traced });
  } else if (view.kind === "unit") {
    const flat = Number(fac?.FacilityLatitude), flon = Number(fac?.FacilityLongitude);
    qa = checkUnit({ site: checkInput.sites[0], facilityAt: flat && flon ? xy([flon, flat]) : null, roadSegments: checkInput.roadSegments, trailSegments: segmentsOf(trails.map((t) => t.f), xy), roadSource: checkInput.roadSource, traced: checkInput.traced });
  } else if (qa.verdict === "not-drawn") {
    // Can't be drawn at all (sites stacked on one spot): no areas to show either.
  } else if (view.kind === "areas") {
    split = { ...view, ...(call ? { by: call.by, on: call.on } : {}) };
    qa = checkAreas(qa, view.areas, checkInput);
  } else if (view.kind === "dispersed") {
    split = view;
    qa = checkDispersed(qa, view.groups);
  }

  // The credit line names each layer's source, so a reader can tell what came from where.
  // What the traces were drawn over (the trace's `photo`): aerial photos, lidar relief, or both.
  const over = tracedOver(trace?.photo);
  const SRC = { nps: "National Park Service", osm: "OpenStreetMap", usfs: "Forest Service", tiger: "US Census Bureau (TIGER)", usgs: "USGS", traced: `CampHawk, traced from ${over}` };
  const poiSrc = [...new Set(pois.map((p) => p.src))];
  const roadCredit = replaced ? SRC.traced
    : [roadSource !== "none" && SRC[roadSource], traced.length && (roadSource === "none" ? SRC.traced : `campground roads CampHawk traced from ${over}`)].filter(Boolean).join(", and ");
  const credit = [
    `Drawn by CampHawk. Sites: Recreation.gov (RIDB, CC BY 4.0)${moved ? `; ${moved === 1 ? "one" : moved} moved by CampHawk to where aerial photos show ${moved === 1 ? "it" : "them"}` : ""}.`,
    roadCredit && `Roads: ${roadCredit}.`,
    poiSrc.length && `Restrooms and water: ${poiSrc.map((k) => SRC[k]).join(" and ")}.`,
    (waterParts.length || flowlines.length) && `Lakes and rivers: ${SRC[waterSource]}.`,
  ].filter(Boolean);
  const usedOsm = (roadSource === "osm" && !replaced) || poiSrc.includes("osm") || (waterSource === "osm" && (waterParts.length || flowlines.length)) || (roadSource !== "nps" && (trails.length || lots.length || buildings.length));
  if (usedOsm) credit.push("Map data © OpenStreetMap contributors.");
  credit.push("Positions are approximate. Check the booking site before you go.");
  const credits = credit.join(" ");

  const roadOut = (r) => ({ name: r.name, cls: r.cls, oneWay: r.oneWay, ...(r.traced ? { traced: true } : {}), d: pathOf(lines(r.f.geometry), false) });
  const map = {
    facilityId,
    name: fac?.FacilityName?.trim() ?? meta.name ?? "",
    agency: AGENCY[fac?.OrgFacilityID] ?? meta.agency ?? "",
    ...(meta.state ? { state: meta.state } : {}),
    ...(meta.recArea ? { recArea: meta.recArea } : {}),
    source: { ridbExport: "RIDB full export (CSV), Recreation.gov, CC BY 4.0", built: new Date().toISOString().slice(0, 10) },
    sources: {
      roads: roadSource,
      /** Why that source (roads.mjs), and how every source's roads fit the sites. */
      roadPick: { why: picked.why, fits: roadFits },
      water: waterSource,
      osm: Boolean(usedOsm),
      /** Where OSM was read: a dated regional extract, or the live API (osm.mjs). */
      ...(osmFrom ? { osmFrom: osmFrom.from === "extract" ? { from: "extract", regions: osmFrom.regions, asOf: osmFrom.asOf } : { from: "api", on: new Date().toISOString().slice(0, 10) } } : {}),
      traced: { roads: traced.length, points: tracedPoints.length, ...(replaced ? { replace: true } : {}), ...(trace ? { by: trace.by ?? "", on: trace.traced ?? "", note: trace.note ?? "" } : {}) },
    },
    credits,
    frame,
    /** The frame in degrees [west, south, east, north], to ask for the aerial photo under it. */
    bbox: bboxArr.map((v) => Math.round(v * 1e6) / 1e6),
    labels,
    roads: kept(roads.map(roadOut)),
    /** With a trace that replaces the roads, the source's roads it replaced, for the tracing tool. */
    ...(replaced && roadSource !== "none" ? { sourceRoads: kept(candidates[roadSource].map(roadOut)) } : {}),
    trails: kept(trails.map((t) => ({ name: t.name, d: pathOf(lines(t.f.geometry), false) }))),
    lots: kept(lots.map((parts) => ({ d: pathOf(parts, true) }))),
    water: kept(waterParts.map((w) => ({ fcode: w.fcode, d: pathOf(w.parts, true) }))),
    buildings: kept(buildings.map((b) => ({ name: b.name, type: b.type, d: pathOf(b.parts, true) }))),
    pois: pois.map((p) => ({ name: p.name, type: p.type, at: p.at, ...(p.src === "traced" ? { traced: true } : {}) })),
    sites: outSites,
    /** How a camper sees it: several areas (areas.ts), or dispersed; absent for one campground or one unit. */
    ...(split ? { split } : {}),
    /** A first-come campground: what RIDB says about it (first-come.mjs), for the first-come map. */
    ...(firstCome ? { firstCome } : {}),
    /** The trace built in (studio/campground-maps/traces/), so the lab's tracing tool edits it whole. */
    ...(trace ? { trace } : {}),
    /** What the checks compared against, kept so a reviewer sees it on the aerial photo. */
    evidence: {
      // One ring per entry, so each ring keeps OpenStreetMap's name (first-come.ts pickOutline).
      ...outlineEvidence(osm?.outlines ?? [], pathOf),
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
