/**
 * Rig Studio's free-form sketches: joints, blocks, stock fill, towers, loads and checks. The roof
 * case must come out exactly like the Rig Planner's Air Pro roof (rig.test.mts measures that one).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildList } from "./build.ts";
import { rentalList } from "./bom.ts";
import { newDesign } from "./templates.ts";
import { compileSketch, emptySketch, pointLines, readSketch, sketchChecks, sketchFromRoof, sketchLoads, type Sketch } from "./sketch.ts";
import type { BuildList } from "./types.ts";

const tally = (l: BuildList) => {
  const m: Record<string, number> = {};
  for (const p of l.parts) {
    const k = p.kind === "truss" ? `${p.role === "tower" ? "tower" : "truss"}-${p.length}` : p.kind === "corner" ? `corner-${p.role ?? "plain"}-${p.size}` : `${p.kind}-${"size" in p ? p.size : ""}`;
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
};

const square = (size = 240, z = 240): Sketch => {
  const sk = emptySketch("Square", "box12");
  sk.runs = [
    { id: "a", a: [0, 0, z], b: [size, 0, z] },
    { id: "b", a: [size, 0, z], b: [size, size, z] },
    { id: "c", a: [size, size, z], b: [0, size, z] },
    { id: "d", a: [0, size, z], b: [0, 0, z] },
  ];
  return sk;
};

test("a square of four runs gets a corner block at each joint and sections between the blocks", () => {
  const c = compileSketch(square());
  const corners = c.list.parts.filter((p) => p.kind === "corner");
  assert.equal(corners.length, 4);
  const truss = c.list.parts.filter((p) => p.kind === "truss");
  // 240" joint to joint, less 6" at each block: 228" = 10' + 8' + ... must be exact or noted.
  const perRun = truss.filter((t) => c.owner[t.id] === "a");
  assert.equal(perRun.reduce((s, t) => s + (t.kind === "truss" ? t.length : 0), 0), 228);
  assert.deepEqual(c.list.notes, []);
  const first = perRun[0];
  assert.ok(first.kind === "truss" && first.start[0] === 6 && first.start[2] === 240);
});

test("two runs meeting in a straight line join without a block; a free end has none", () => {
  const sk = emptySketch("Line", "box12");
  sk.runs = [
    { id: "a", a: [0, 0, 200], b: [120, 0, 200] },
    { id: "b", a: [120, 0, 200], b: [240, 0, 200] },
  ];
  const c = compileSketch(sk);
  assert.equal(c.list.parts.filter((p) => p.kind === "corner").length, 0);
  assert.deepEqual(c.list.parts.filter((p) => p.kind === "truss").map((p) => (p.kind === "truss" ? p.length : 0)), [120, 120]);
});

test("a run that no stock adds up to is noted, never silently shortened", () => {
  const sk = emptySketch("Odd", "box12");
  sk.runs = [{ id: "a", a: [0, 0, 100], b: [125, 0, 100], label: "Upstage" }];
  const c = compileSketch(sk);
  assert.match(c.list.notes[0], /Upstage: no stock sections add up to 125"/);
});

test("the Air Pro roof as a sketch compiles to exactly the Rig Planner's roof", () => {
  const d = newDesign("roof");
  const sk = sketchFromRoof(d.name, d.params);
  const fromSketch = compileSketch(sk).list;
  const fromTemplate = buildList(d);
  assert.deepEqual(tally(fromSketch), tally(fromTemplate));
  assert.deepEqual(fromSketch.notes, []);
  const names = (l: BuildList) => rentalList(l).map((x) => `${x.qty} ${x.item}`);
  assert.deepEqual(names(fromSketch), names(fromTemplate));
  // Same sleeve positions (the drawing's tower centers, shifted to start at 0).
  const sleeves = (l: BuildList) => l.parts.filter((p) => p.kind === "corner" && p.role === "sleeve").map((p) => (p.kind === "corner" ? p.center.join(",") : "")).sort();
  assert.deepEqual(sleeves(fromSketch), sleeves(fromTemplate));
});

test("a leg standing on the floor gets a base plate; a sloped run is flagged for the connector", () => {
  const sk = emptySketch("Legs", "box12");
  sk.runs = [
    { id: "l", a: [0, 0, 0], b: [0, 0, 120] },
    { id: "s", a: [0, 0, 120], b: [96, 96, 120] },
  ];
  const c = compileSketch(sk);
  assert.equal(c.list.parts.filter((p) => p.kind === "baseplate").length, 1);
  assert.ok(c.list.notes.some((n) => /Run s isn't level along X or Y/.test(n)));
});

test("loads go to the nearest points and add up to the whole rig", () => {
  const sk = square();
  sk.points = [
    { id: "p1", at: [0, 0, 240], kind: "hoist", capacity: 1000 },
    { id: "p2", at: [240, 240, 240], kind: "hoist", capacity: 1000 },
  ];
  sk.loads = [{ id: "spk", at: [120, 0, 240], lb: 300, label: "Speaker" }];
  const c = compileSketch(sk);
  const { supports, total, unsupported } = sketchLoads(sk, c);
  assert.equal(unsupported, 0);
  assert.ok(Math.abs(supports.reduce((s, x) => s + x.lb, 0) - total) < 0.5);
  const truss = c.list.parts.reduce((s, p) => s + (p.kind === "truss" ? (p.length / 12) * 4.3 : p.kind === "corner" ? 14 : 0), 0);
  assert.ok(Math.abs(total - (truss + 300)) < 0.5);
});

test("checks: nothing holding it up, an overloaded point, a long span, in words", () => {
  const bare = square(480);
  let f = sketchChecks(bare, compileSketch(bare));
  assert.ok(f.some((x) => x.id === "none" && x.level === "warn"));
  const one = square(480);
  one.points = [{ id: "p1", at: [0, 0, 240], kind: "hoist", capacity: 100, label: "DSL" }];
  f = sketchChecks(one, compileSketch(one));
  assert.ok(f.some((x) => x.id === "over-p1" && /DSL carries about \d+ lb, over its 100 lb/.test(x.text)));
  assert.ok(f.some((x) => x.id === "span" && x.level === "warn"));
  assert.deepEqual(sketchChecks(emptySketch("x"), compileSketch(emptySketch("x"))).map((x) => x.id), ["empty"]);
});

test("readSketch fills defaults and refuses duplicate ids or runs below the floor", () => {
  const ok = readSketch({ name: "A", series: "box12", runs: [{ id: "a", a: [0, 0, 100], b: [120, 0, 100] }] });
  assert.ok(ok.sketch && ok.sketch.points.length === 0 && ok.sketch.towerLimit === 2000);
  const dup = readSketch({ name: "A", series: "box12", runs: [{ id: "a", a: [0, 0, 1], b: [9, 0, 1] }], points: [{ id: "a", at: [0, 0, 1] }] });
  assert.equal(dup.sketch, null);
  assert.match(dup.problems.join(), /id "a" is used twice/);
  assert.equal(readSketch({ name: "A", series: "box12", runs: [{ id: "a", a: [0, 0, -5], b: [9, 0, 1] }] }).sketch, null);
  assert.equal(readSketch({ name: "", series: "box12" }).sketch, null);
});

test("hoists on the rental list by size", () => {
  const sk = emptySketch("x");
  sk.points = [
    { id: "a", at: [0, 0, 0], kind: "hoist", capacity: 2000 },
    { id: "b", at: [0, 0, 0], kind: "hoist", capacity: 2000 },
    { id: "c", at: [0, 0, 0], kind: "hoist", capacity: 1000 },
    { id: "d", at: [0, 0, 0], kind: "deadhang", capacity: 500 },
  ];
  assert.deepEqual(pointLines(sk).map((l) => `${l.qty} ${l.item}`), ["2 Chain hoist, 1 ton", "1 Chain hoist, ½ ton", "1 Dead-hang point (steel and shackles)"]);
});

import { applyOps } from "./sketchOps.ts";

test("edits add, move, change and remove, naming new things in order, and refuse bad ones whole", () => {
  const sk = emptySketch("E", "box12");
  const r = applyOps(sk, [
    { op: "add_run", a: [0, 0, 240], b: [240, 0, 240], label: "Upstage" },
    { op: "add_point", at: [0, 0, 240], capacity: 1000 },
    { op: "add_point", at: [240, 0, 240] },
    { op: "move", ids: ["r1", "p1", "p2"], by: [0, 96, 0] },
    { op: "update", id: "p2", capacity: 500 },
  ]);
  assert.ok("sketch" in r);
  assert.deepEqual(r.sketch.runs[0], { id: "r1", a: [0, 96, 240], b: [240, 96, 240], label: "Upstage" });
  assert.equal(r.sketch.points[1].capacity, 500);
  assert.equal(sk.runs.length, 0, "the original is untouched");
  const bad = applyOps(r.sketch, [{ op: "remove", ids: ["nope"] }, { op: "add_run", a: [0, 0, 1], b: [0, 0, 1] }]);
  assert.ok("problems" in bad && /no nope/.test(bad.problems.join()));
  const gone = applyOps(r.sketch, [{ op: "remove", ids: ["p1"] }]);
  assert.ok("sketch" in gone && gone.sketch.points.map((p) => p.id).join() === "p2");
});
