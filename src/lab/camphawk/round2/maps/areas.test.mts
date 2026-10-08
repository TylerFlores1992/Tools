import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AREA_MAX_SPAN_M, MAX_AREAS, areaMap, areaName, areaOf, hull, outline, splitAreas, unplacedSites } from "./areas.ts";
import type { SiteMapData } from "./index.ts";

const MAPS = join(import.meta.dirname, "../../../../../public/private/camphawk/maps");
const load = (id: string): SiteMapData => JSON.parse(readFileSync(join(MAPS, `ridb-${id}.json`), "utf8"));
const spanOf = (m: SiteMapData, names: string[]) => {
  const ps = m.sites.filter((s) => names.includes(s.name) && s.at).map((s) => s.at!);
  const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};

test("a compact campground is one area (Moraine Park, Upper Pines-sized)", () => {
  assert.equal(splitAreas(load("232463").sites).kind, "one");
});

test("clusters with kilometres between them split at the gaps (Seven Points, Ives Run, Dinkey Creek)", () => {
  for (const id of ["233626", "233523", "232136"]) {
    const m = load(id), s = splitAreas(m.sites);
    assert.equal(s.kind, "areas", id);
    if (s.kind !== "areas") continue;
    assert.ok(s.areas.length >= 2 && s.areas.length <= MAX_AREAS, `${id}: ${s.areas.length}`);
    const placed = m.sites.filter((x) => x.at).map((x) => x.name).sort();
    assert.deepEqual(s.areas.flatMap((a) => a.sites).sort(), placed, `${id}: every placed site in exactly one area`);
    for (const a of s.areas) assert.ok(spanOf(m, a.sites) <= AREA_MAX_SPAN_M, `${id} ${a.name} spans ${spanOf(m, a.sites)} m`);
  }
});

test("one long string of loops is cut by its loop letters into readable areas (Diamond Lake, 3.5 km)", () => {
  const m = load("231980"), s = splitAreas(m.sites);
  assert.equal(s.kind, "areas");
  if (s.kind !== "areas") return;
  for (const a of s.areas) {
    assert.match(a.name, /^Loops? [A-M]/, a.name);
    // Merged loops fit; a single loop is never cut, whatever its length (Loop G runs ~1.9 km).
    if (a.name.startsWith("Loops ")) assert.ok(spanOf(m, a.sites) <= AREA_MAX_SPAN_M, `${a.name} spans ${spanOf(m, a.sites)} m`);
  }
  assert.ok(s.areas.length >= 4 && s.areas.length <= 12, `${s.areas.length} areas`);
  // A loop is never cut in two: each letter is in exactly one area (by index, not by name, since
  // two halves of a cut loop would carry the same name).
  const letterAreas = new Map<string, Set<number>>();
  s.areas.forEach((a, i) => { for (const n of a.sites) { const l = n[0]; (letterAreas.get(l) ?? letterAreas.set(l, new Set()).get(l)!).add(i); } });
  for (const [l, set] of letterAreas) assert.equal(set.size, 1, `loop ${l} is in ${set.size} areas`);
  assert.equal(new Set(s.areas.map((a) => a.name)).size, s.areas.length, "every area has its own name");
});

test("dispersed sites along a river are a list, not ten tiny maps (Au Sable, 101 sites over 35 km)", () => {
  assert.equal(splitAreas(load("234130").sites).kind, "dispersed");
});

test("areas are named for what the sites are called", () => {
  assert.equal(areaName(["A003", "A001", "A010"]), "Loop A");
  assert.equal(areaName(["B01", "C02", "D03"]), "Loops B–D");
  assert.equal(areaName(["A1", "B1", "C1", "E1"]), "Loops A–C and E");
  assert.equal(areaName(["A1", "B1", "E1"]), "Loops A, B and E");
  assert.equal(areaName(["B01", "D03"]), "Loops B and D");
  assert.equal(areaName(["F01", "H02", "J03"]), "Loops F, H and J");
  assert.equal(areaName(["045", "001", "010"]), "Sites 001–045");
  assert.equal(areaName(["001", "045", "Group Camp"]), "Sites 001–045");
  assert.equal(areaName(["017"]), "Site 017");
});

test("an area's map shows only its sites, inside its own frame, and a site finds its area", () => {
  const m = load("233626"), s = splitAreas(m.sites);
  assert.equal(s.kind, "areas");
  if (s.kind !== "areas") return;
  const a = s.areas[0], am = areaMap(m, a);
  assert.deepEqual(am.sites.map((x) => x.name).sort(), [...a.sites].sort());
  for (const x of am.sites) if (x.at) {
    assert.ok(x.at[0] >= am.frame.x && x.at[0] <= am.frame.x + am.frame.w && x.at[1] >= am.frame.y && x.at[1] <= am.frame.y + am.frame.h, x.name);
  }
  assert.ok(am.frame.w >= am.frame.h / 2 && am.frame.h >= am.frame.w / 2, "never thinner than 1:2");
  assert.equal(areaOf(s, a.sites[0]), a);
  assert.equal(areaOf(s, "no such site"), null);
});

test("an area's outline holds every one of its sites, and the hull is convex", () => {
  const m = load("231980"), s = splitAreas(m.sites);
  assert.equal(s.kind, "areas");
  if (s.kind !== "areas") return;
  for (const a of s.areas) {
    const ring = outline(m, a, 40);
    assert.ok(ring.length >= 3);
    const inside = ([x, y]: [number, number]) => ring.every((p, i) => { const q = ring[(i + 1) % ring.length]; return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) >= -1e-6; });
    for (const site of m.sites) if (site.at && a.sites.includes(site.name)) assert.ok(inside(site.at), `${a.name}: ${site.name}`);
  }
  assert.deepEqual(hull([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2]]), [[0, 0], [2, 0], [2, 2], [0, 2]]);
});

test("sites with no point are counted, so the area counts add up to the listing", () => {
  const m = load("233626"), s = splitAreas(m.sites);
  if (s.kind !== "areas") return assert.fail("expected areas");
  assert.equal(s.areas.reduce((n, a) => n + a.sites.length, 0) + unplacedSites(m.sites).length, m.sites.length);
  assert.ok(unplacedSites(m.sites).length > 0);
});
