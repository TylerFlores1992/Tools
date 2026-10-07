import assert from "node:assert/strict";
import test from "node:test";
import { SITES } from "../campground-data.ts";
import { isWaymark, mapFor, nearestRestroomFt, scaleBar, siteTypeLabel } from "./index.ts";

const map = mapFor("upper-pines")!;

test("Upper Pines has a drawn map; a campground without one says so (null), never an empty map", () => {
  assert.ok(map);
  assert.equal(mapFor("lower-pines"), null);
});

test("every example site on the calendar is a real Upper Pines site with a point on the map", () => {
  for (const id of Object.keys(SITES)) {
    const s = map.sites.find((m) => m.name === id);
    assert.ok(s, `site ${id} is not in RIDB's Upper Pines list`);
    assert.ok(s.at, `site ${id} has no point`);
    assert.equal(siteTypeLabel(s.type), SITES[id].type, `site ${id}: the calendar's type must be RIDB's`);
  }
});

test("staff (management) sites are never drawn as bookable sites", () => {
  assert.ok(map.sites.every((s) => s.type !== "MANAGEMENT"));
});

test("every site point sits inside the map's frame", () => {
  const f = map.frame;
  for (const s of map.sites) if (s.at) {
    const [x, y] = s.at;
    assert.ok(x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h, `site ${s.name} at ${x},${y} is outside the frame`);
  }
});

test("a fact RIDB records as 0 is dropped, not shown as '0 ft'", () => {
  for (const s of map.sites) {
    for (const k of ["maxVehicleFt", "maxPeople"] as const) if (s[k] !== undefined) assert.ok(s[k]! > 0, `site ${s.name} ${k}=${s[k]}`);
  }
});

test("nearest restroom is the straight-line distance to the closest one, in feet rounded to 10", () => {
  const s = map.sites.find((m) => m.name === "042")!;
  const metres = Math.min(...map.pois.filter((p) => p.type === "Restroom").map((p) => Math.hypot(p.at[0] - s.at![0], p.at[1] - s.at![1])));
  assert.equal(nearestRestroomFt(map, s), Math.round((metres * 3.28084) / 10) * 10);
  assert.equal(nearestRestroomFt(map, { ...s, at: null }), null);
});

test("the scale bar is a round number of feet near a fifth of the map's width", () => {
  const { ft, metres } = scaleBar(map);
  assert.ok([25, 50, 100, 200, 250, 300, 500, 1000, 2000].includes(ft));
  assert.ok(Math.abs(metres * 3.28084 - ft) < 1e-9);
  assert.ok(metres > map.frame.w / 10 && metres < map.frame.w / 3);
  // Zoomed, the bar shrinks with the view instead of running off it.
  const z = scaleBar(map, 3.5);
  assert.ok(z.metres < metres && z.metres < map.frame.w / 3.5 / 2);
});

test("type labels read after a comma, with RV kept as an initialism", () => {
  assert.equal(siteTypeLabel("RV NONELECTRIC"), "RV nonelectric");
  assert.equal(siteTypeLabel("TENT ONLY NONELECTRIC"), "tent only nonelectric");
  assert.ok(isWaymark("040") && !isWaymark("042") && !isWaymark("A10"));
});
