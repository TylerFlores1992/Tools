// Writes a trace file (traces/ridb-<id>.json, the format trace.mjs checks) from roads and points
// given in a built map's local metres, as read off aerial-grid.mjs's grid. The review page's
// tracing tool writes the same file from clicks; this is the session's way.
//
//   node studio/campground-maps/trace-from-grid.mjs <map.json> <spec.json> [by]
//
// spec.json: { "roads": [ [[x, y], …] | { "c": [[x, y], …], "through": true, "name": "WY 70" } ],
//              "points": [{ "type": "Restroom" | "Water", "at": [x, y] }],
//              "sites": [{ "name": "A09", "at": [x, y] }],   (a site moved to where the photo shows it)
//              "replace": false, "note": "what was left out and why" }
// Then rebuild the map (build-sample.mjs <ridb-dir> <id>) and check it with aerial-grid.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TRACES, traceProblems } from "./trace.mjs";
import { aerialSource } from "../../src/lab/camphawk/round2/maps/aerial.ts";

const [file, specFile, by = "Claude (CampHawk session)"] = process.argv.slice(2);
if (!file || !specFile) { console.error("usage: trace-from-grid.mjs <map.json> <spec.json> [by]"); process.exit(1); }
const map = JSON.parse(readFileSync(file, "utf8"));
const t = JSON.parse(readFileSync(specFile, "utf8"));
const f = map.frame, [w, s, e, n] = map.bbox;
const deg = ([x, y]) => [Math.round((w + ((x - f.x) / f.w) * (e - w)) * 1e7) / 1e7, Math.round((n - ((y - f.y) / f.h) * (n - s)) * 1e7) / 1e7];
const out = {
  version: 1, map: `ridb-${map.facilityId}`, traced: new Date().toISOString().slice(0, 10), by,
  photo: aerialSource(map)?.credit ?? "none",
  roads: t.roads.map((r) => ({ coords: (Array.isArray(r) ? r : r.c).map(deg), ...(r.through ? { through: true } : {}), ...(r.name ? { name: r.name } : {}) })),
  points: (t.points ?? []).map((p) => ({ type: p.type, at: deg(p.at) })),
  ...(t.sites?.length ? { sites: t.sites.map((m) => ({ name: m.name, at: deg(m.at) })) } : {}),
  ...(t.replace ? { replace: true } : {}),
  note: t.note ?? "",
};
const problems = traceProblems(out, out.map, map.bbox);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const dest = join(TRACES, `${out.map}.json`);
writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
const names = new Set(map.sites.map((x) => x.name));
const unknown = (out.sites ?? []).filter((m) => !names.has(m.name)).map((m) => m.name);
if (unknown.length) { console.error(`no such site in ${out.map}: ${unknown.join(", ")}`); process.exit(1); }
console.log(dest, `${out.roads.length} roads, ${out.points.length} points${out.sites ? `, ${out.sites.length} sites moved` : ""}${out.replace ? " (replaces the source's roads)" : ""}`);
