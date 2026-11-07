/**
 * The Rig Planner's geometry, rental list, checks and plain-words edits. The cube case is the rig
 * built by hand in Vectorworks on 2026-11-07 and checked from the front, side and top views:
 * every coordinate here was measured there.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildList, splitRun } from "./build.ts";
import { countJoints, rentalList, rentalText, totalWeight } from "./bom.ts";
import { checks } from "./checks.ts";
import { applyEdit, parseEdit } from "./commands.ts";
import { newDesign, TEMPLATES } from "./templates.ts";
import type { ClampPart, Part, PipePart, TrussPart, Vec3 } from "./types.ts";

const close = (a: Vec3, b: Vec3, tol = 0.01) => a.every((x, i) => Math.abs(x - b[i]) <= tol);
const has = (parts: Part[], pred: (p: Part) => boolean, msg: string) => assert.ok(parts.some(pred), msg);
const cube = () => buildList(newDesign("cube"));

test("splitRun picks the fewest stock sections and says when nothing fits exactly", () => {
  const stock = [120, 96, 60, 48, 30, 24, 12];
  assert.deepEqual(splitRun(96, stock), { pieces: [96], exact: true });
  assert.deepEqual(splitRun(216, stock), { pieces: [120, 96], exact: true });
  assert.deepEqual(splitRun(18, stock), { pieces: [12], exact: false });
  assert.deepEqual(splitRun(0, stock), { pieces: [], exact: true });
});

test("10x10x10 cube: 12 sticks of 8', 8 corner blocks, 10' outside", () => {
  const list = cube();
  const truss = list.parts.filter((p): p is TrussPart => p.kind === "truss");
  assert.equal(truss.length, 12);
  assert.ok(truss.every((t) => t.length === 96));
  assert.equal(list.parts.filter((p) => p.kind === "corner").length, 8);
  assert.deepEqual(list.notes, []);
  const xs = list.parts.flatMap((p) => (p.kind === "corner" ? [p.center[0] - 6, p.center[0] + 6] : []));
  assert.equal(Math.min(...xs), 0);
  assert.equal(Math.max(...xs), 120);
});

test("cube legs stand on the floor blocks' centers, between the rings", () => {
  const legs = cube().parts.filter((p): p is TrussPart => p.kind === "truss" && p.role === "leg");
  assert.equal(legs.length, 4);
  has(legs, (p) => p.kind === "truss" && close(p.start, [6, 6, 12]) && close(p.end, [6, 6, 108]), "front-left leg");
  has(legs, (p) => p.kind === "truss" && close(p.start, [114, 114, 12]), "back-right leg");
});

test("cube top braces match the build checked in Vectorworks (front face)", () => {
  const parts = cube().parts;
  const pipes = parts.filter((p): p is PipePart => p.kind === "pipe");
  assert.equal(pipes.length, 8, "top only by default: two per face");
  has(pipes, (p) => p.kind === "pipe" && close(p.start, [8.88, -2, 77.18]) && close(p.end, [42.82, -2, 111.12]), "front top-left pipe");
  has(pipes, (p) => p.kind === "pipe" && close(p.start, [111.12, -2, 77.18]), "front top-right pipe");
  const clamps = parts.filter((p): p is ClampPart => p.kind === "clamp");
  assert.equal(clamps.length, 16);
  const legClamp = clamps.find((c) => close(c.at, [11, -2, 79.3]));
  assert.ok(legClamp, "clamp on the front-left leg's inner chord");
  assert.deepEqual(legClamp.chordDir, [0, 0, 1]);
  assert.deepEqual(legClamp.normal, [0, 1, 0]);
  assert.equal(legClamp.offset, 3);
  const topClamp = clamps.find((c) => close(c.at, [40.7, -2, 109]));
  assert.ok(topClamp, "clamp on the top beam's lower chord");
  assert.deepEqual(topClamp.chordDir, [1, 0, 0]);
});

test("every clamp sits on its pipe, and its other jaw lands on a truss chord", () => {
  const list = buildList(newDesign("cube", { braces: "both" }));
  const pipes = list.parts.filter((p): p is PipePart => p.kind === "pipe");
  const clamps = list.parts.filter((p): p is ClampPart => p.kind === "clamp");
  assert.equal(pipes.length, 16);
  assert.equal(clamps.length, 32);
  for (const c of clamps) {
    const onPipe = pipes.some((p) => {
      const d: Vec3 = [p.end[0] - p.start[0], p.end[1] - p.start[1], p.end[2] - p.start[2]];
      const t = ((c.at[0] - p.start[0]) * d[0] + (c.at[1] - p.start[1]) * d[1] + (c.at[2] - p.start[2]) * d[2]) / (p.length * p.length);
      const q: Vec3 = [p.start[0] + d[0] * t, p.start[1] + d[1] * t, p.start[2] + d[2] * t];
      return t > 0 && t < 1 && close(q, c.at, 0.02);
    });
    assert.ok(onPipe, `clamp ${c.id} is on a pipe`);
    const chord: Vec3 = [c.at[0] + c.normal[0] * c.offset, c.at[1] + c.normal[1] * c.offset, c.at[2] + c.normal[2] * c.offset];
    // Chord centerlines are 1" in from a 0..12 or 108..120 face on both cross axes.
    const ok = (x: number) => [1, 11, 109, 119].some((k) => Math.abs(x - k) < 0.02);
    const axes = [0, 1, 2].filter((i) => Math.abs(c.chordDir[i]) < 0.5);
    assert.ok(axes.every((i) => ok(chord[i])), `clamp ${c.id}'s far jaw ${chord} is on a chord`);
  }
});

test("removing the bottom pipes leaves 8 pipes and 16 cheeseboroughs", () => {
  const d0 = newDesign("cube", { braces: "both" });
  const edit = parseEdit("remove the bottom pipes");
  assert.ok(edit);
  const { design } = applyEdit(d0, edit);
  assert.equal(design.params.braces, "top");
  const list = buildList(design);
  assert.equal(list.parts.filter((p) => p.kind === "pipe").length, 8);
  assert.equal(list.parts.filter((p) => p.kind === "clamp").length, 16);
});

test("rental list for the cube matches what was quoted on 2026-11-07", () => {
  const lines = rentalList(cube());
  const qty = (key: string) => lines.find((l) => l.key === key)?.qty;
  assert.equal(qty("truss-96"), 12);
  assert.equal(qty("corner"), 8);
  assert.equal(qty("connectors"), 96, "24 joints × 4 chords");
  assert.equal(qty("pipe-48"), 8);
  assert.equal(qty("clamp"), 16);
  assert.ok(totalWeight(lines) > 500 && totalWeight(lines) < 700);
  assert.match(rentalText("Cube", lines), /12 × 12" box truss, 8' section/);
});

test("joints: a tower on a base plate counts its plate and each splice, not its free top", () => {
  const list = buildList(newDesign("tower", { height: 216 }));
  assert.deepEqual(
    list.parts.filter((p) => p.kind === "truss").map((p) => (p as TrussPart).length),
    [120, 96],
  );
  assert.equal(countJoints(list), 2);
});

test("goal post: two legs on plates, a header, braces in its plane", () => {
  const list = buildList(newDesign("goalpost"));
  assert.equal(list.parts.filter((p) => p.kind === "baseplate").length, 2);
  assert.ok(list.parts.some((p) => p.kind === "truss" && p.role === "header"));
  assert.equal(list.parts.filter((p) => p.kind === "pipe").length, 2);
  assert.deepEqual(list.notes, []);
});

test("every template builds with its defaults and no notes", () => {
  for (const t of TEMPLATES) {
    const list = buildList(newDesign(t.id));
    assert.ok(list.parts.length > 0, t.id);
    assert.deepEqual(list.notes, [], t.id);
  }
});

test("20.5 box makes odd runs and says so instead of guessing", () => {
  const list = buildList(newDesign("cube", { series: "box20" }));
  assert.ok(list.notes.length > 0);
  const f = checks(newDesign("cube", { series: "box20" }), list);
  assert.ok(f.some((x) => x.level === "warn" && /no stock sections/.test(x.text)));
});

test("checks: a tall skinny tower warns, a cube with no braces warns", () => {
  const tower = newDesign("tower", { height: 20 * 12 });
  assert.ok(checks(tower, buildList(tower)).some((f) => f.id === "tip" && f.level === "warn"));
  const bare = newDesign("cube", { braces: "none", height: 12 * 12 });
  assert.ok(checks(bare, buildList(bare)).some((f) => f.id === "braces"));
  const fine = newDesign("cube");
  assert.ok(checks(fine, buildList(fine)).some((f) => f.id === "tip" && f.level === "ok"));
});

test("plain-words edits", () => {
  const e1 = parseEdit("10x10x10 cube, 12-inch box, knee braces up top");
  assert.ok(e1);
  assert.equal(e1.template, "cube");
  assert.equal(e1.width, 120);
  assert.equal(e1.height, 120);
  const e2 = parseEdit("make it 12 feet tall");
  assert.equal(e2?.height, 144);
  assert.equal(parseEdit("swap to 20.5 box")?.series, "box20");
  assert.equal(parseEdit("no braces")?.braces, "none");
  assert.equal(parseEdit("braces at every corner")?.braces, "both");
  assert.equal(parseEdit("goal post 20 x 14")?.height, 168);
  assert.equal(parseEdit("flown grid 30x20 trim at 22 ft")?.trim, 264);
  assert.equal(parseEdit("use 5 ft pipes")?.braceLength, 60);
  assert.equal(parseEdit("what's the weather"), null);
});

test("edits stay inside the template's limits and rename auto-named designs", () => {
  const d = newDesign("cube");
  const { design, changes } = applyEdit(d, { ...parseEdit("make it 100 feet tall")! });
  assert.equal(design.params.height, 30 * 12);
  assert.ok(changes.some((c) => c.startsWith("height")));
  assert.equal(design.name, "10' × 10' × 30' cube");
  const named = { ...d, name: "Stage left cube" };
  assert.equal(applyEdit(named, parseEdit("12 ft tall")!).design.name, "Stage left cube");
});

test("top and bottom braces that would cross on a short leg are refused, not drawn", () => {
  const small = buildList(newDesign("cube", { width: 120, depth: 120, height: 72, braces: "both", braceLength: 48 }));
  assert.ok(small.notes.some((n) => /doesn't fit/.test(n)));
  assert.equal(small.parts.filter((p) => p.kind === "pipe").length, 0);
  const topOnly = buildList(newDesign("cube", { width: 120, depth: 120, height: 72, braces: "top", braceLength: 48 }));
  assert.deepEqual(topOnly.notes, []);
});
