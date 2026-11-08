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
import { fitBays, newDesign, TEMPLATES } from "./templates.ts";
import { towerLoads } from "./loads.ts";
import type { BaseplatePart, ClampPart, CornerPart, Part, PipePart, TrussPart, Vec3 } from "./types.ts";

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

// ---- Stage decks. The deck and leg positions are the ones measured on Vectorworks' own
// "Stage Deck 4ft x 8ft x 2ft" and "4ft x 4ft x 2ft" on 2026-11-07 (docs/RIG.md).

const stage = (o: Partial<Parameters<typeof newDesign>[1]> = {}) => buildList(newDesign("stage", o));

test("16' × 8' stage at 2': four 4×8 decks, six legs each, placed like the library assembly", () => {
  const list = stage();
  const decks = list.parts.filter((p) => p.kind === "deck");
  assert.equal(decks.length, 4);
  assert.ok(decks.every((d) => d.kind === "deck" && d.length === 96 && d.rotation === 0 && d.at[2] === 21), "underside 3\" below the 24\" nominal");
  const legs = list.parts.filter((p) => p.kind === "leg");
  assert.equal(legs.length, 24);
  // The first deck is centered at (48, 24): legs 1.625" in from every edge, three along each long side.
  for (const at of [[1.625, 1.625], [48, 1.625], [94.375, 1.625], [1.625, 46.375], [48, 46.375], [94.375, 46.375]]) {
    has(legs, (p) => p.kind === "leg" && close(p.at, [at[0], at[1], 0]), `leg at ${at}`);
  }
  assert.deepEqual(list.notes, []);
});

test("odd sizes: a 4×4 fills the leftover 4', and a long narrow stage turns its decks", () => {
  const twelve = stage({ width: 144, depth: 48 });
  const sizes = twelve.parts.flatMap((p) => (p.kind === "deck" ? [p.length] : []));
  assert.deepEqual(sizes, [96, 48]);
  assert.equal(twelve.parts.filter((p) => p.kind === "leg").length, 6 + 4);
  const deep = stage({ width: 48, depth: 192 });
  const d = deep.parts.filter((p) => p.kind === "deck");
  assert.equal(d.length, 2);
  assert.ok(d.every((x) => x.kind === "deck" && x.rotation === 90));
  has(deep.parts, (p) => p.kind === "leg" && close(p.at, [1.625, 48, 0]), "middle leg on the long side, now along Y");
});

test("skirt, rails and stairs: front and sides skirted, rails back and sides, stairs on the front", () => {
  const list = stage({ height: 36, skirt: true, rail: "three", stairs: 2 });
  const skirts = list.parts.filter((p) => p.kind === "skirt");
  assert.equal(skirts.reduce((a, s) => a + (s.kind === "skirt" ? s.length : 0), 0), 192 + 96 + 96);
  assert.ok(skirts.every((s) => s.kind === "skirt" && s.drop === 37 && s.start[2] === 37), "hangs from the 37\" surface to the floor");
  const rails = list.parts.filter((p) => p.kind === "rail");
  assert.equal(rails.reduce((a, r) => a + (r.kind === "rail" ? r.length : 0), 0), 192 + 96 + 96);
  assert.ok(rails.every((r) => r.kind === "rail" && !(r.start[1] === 0 && r.end[1] === 0)), "nothing along the front");
  const stairs = list.parts.filter((p) => p.kind === "stairs");
  assert.equal(stairs.length, 2);
  assert.ok(stairs.every((s) => s.kind === "stairs" && s.risers === 5 && s.at[1] === 0), "37\" in 7.5\" risers = 5");
  const lines = rentalList(list);
  const qty = (key: string) => lines.find((l) => l.key === key)?.qty;
  assert.equal(qty("deck-96"), 4);
  assert.equal(qty("leg-36"), 24);
  assert.equal(qty("skirt-192"), 1);
  assert.equal(qty("skirt-96"), 2);
  assert.equal(qty("rail-96"), 4);
  assert.equal(qty("stairs-5"), 2);
  assert.match(rentalText("Stage", lines), /4 × 4' × 8' stage deck/);
});

test("stage checks: rails over 30\", stairs for a step up", () => {
  const tall = newDesign("stage", { height: 36, rail: "back" });
  const f = checks(tall, buildList(tall));
  assert.ok(f.some((x) => x.id === "rail" && x.level === "warn" && /both sides too/.test(x.text)));
  assert.ok(f.some((x) => x.id === "stairs" && x.level === "warn"));
  const low = newDesign("stage", { height: 16, stairs: 1 });
  const g = checks(low, buildList(low));
  assert.ok(g.some((x) => x.id === "rail" && x.level === "ok"));
  assert.ok(!g.some((x) => x.id === "stairs"));
  assert.ok(!g.some((x) => x.id === "span" || x.id === "tip"), "truss checks don't apply");
});

test("stage edits in plain words", () => {
  const e = parseEdit("16x8 stage 2 ft high with skirting and two stairs");
  assert.ok(e);
  assert.equal(e.template, "stage");
  assert.equal(e.width, 192);
  assert.equal(e.depth, 96);
  assert.equal(e.height, 24);
  assert.equal(e.skirt, true);
  assert.equal(e.stairs, 2);
  assert.equal(parseEdit("add guardrails")?.rail, "three");
  assert.equal(parseEdit("rails on the back only")?.rail, "back");
  assert.equal(parseEdit("no rails")?.rail, "none");
  assert.equal(parseEdit("lose the skirt")?.skirt, false);
  assert.equal(parseEdit("no stairs")?.stairs, 0);
  assert.equal(parseEdit("hang skirting on the stage")?.template, "stage");
  assert.equal(parseEdit("flown grid 30x20 trim at 22 ft")?.template, "flown");
  const { design } = applyEdit(newDesign("stage"), parseEdit("make it 3 ft high, rails on the back and sides")!);
  assert.equal(design.params.height, 36);
  assert.equal(design.params.rail, "three");
});

test("deck height snaps to a leg size; truss templates never carry stage extras", () => {
  const { design } = applyEdit(newDesign("stage"), { ...parseEdit("make it 30 inches high")!, stairs: 9 });
  assert.equal(design.params.height, 32, "legs come in 4\" steps: 30 rounds to 32");
  assert.equal(design.params.stairs, 2);
  const cube = applyEdit(newDesign("cube"), { ...parseEdit("make it 12 ft tall")!, skirt: true, rail: "three", stairs: 2 }).design;
  assert.deepEqual([cube.params.skirt, cube.params.rail, cube.params.stairs], [false, "none", 0]);
});

// ---- Ground-support roof. The defaults are the Air Pro self-climber roof (Aspect Lighting, 2022);
// every number below was read piece by piece from its Vectorworks drawing on 2026-11-07 (towers
// at x ±522.02, ±254.02 and y ±252.25, grid bottom 300", 20.5" Total Structures box).


const roof = (o: Partial<Parameters<typeof newDesign>[1]> = {}) => buildList(newDesign("roof", o));
const lengths = (parts: Part[], role: string) =>
  parts.flatMap((p) => (p.kind === "truss" && p.role === role ? [p.length] : [])).sort((a, b) => b - a);
const tally = (xs: number[]) => xs.reduce<Record<number, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});

test("Air Pro roof: towers where the drawing has them, 3 × 10' each, head blocks and bases", () => {
  const list = roof();
  const plates = list.parts.filter((p): p is BaseplatePart => p.kind === "baseplate");
  assert.equal(plates.length, 8);
  assert.ok(plates.every((p) => p.size === 30));
  // Drawing coordinates are centered: ours start at the front-left tower.
  const towersAt = plates.map((p) => [Math.round((p.center[0] - 522) * 10) / 10, p.center[1] - 252.25]);
  for (const x of [-522, -254, 254, 522]) for (const y of [-252.25, 252.25]) assert.ok(towersAt.some(([a, b]) => a === x && b === y), `tower at ${x}, ${y}`);
  assert.deepEqual(tally(lengths(list.parts, "tower")), { 120: 24 });
  const heads = list.parts.filter((p): p is CornerPart => p.kind === "corner" && p.role === "head");
  assert.equal(heads.length, 8);
  assert.ok(heads.every((h) => h.center[2] === 365.375), "head block 361.625–369.125 in the drawing");
  const sleeves = list.parts.filter((p): p is CornerPart => p.kind === "corner" && p.role === "sleeve");
  assert.equal(sleeves.length, 8);
  assert.ok(sleeves.every((s) => s.center[2] === 310.25 && s.size === 28));
});

test("Air Pro roof: the grid is the drawing's sticks, spacers and corner blocks, exactly", () => {
  const list = roof();
  assert.deepEqual(list.notes, []);
  assert.deepEqual(tally(lengths(list.parts, "beam")), { 120: 16 });
  assert.deepEqual(tally(lengths(list.parts, "cross")), { 120: 8, 60: 8, 48: 8 });
  assert.deepEqual(tally(lengths(list.parts, "spine")), { 120: 8, 7: 3, 0.5: 3 });
  assert.equal(list.parts.filter((p) => p.kind === "corner" && !p.role).length, 4);
  // Spine corner blocks sit on the cross beams at mid-span, at the grid's height.
  const corners = list.parts.filter((p): p is CornerPart => p.kind === "corner" && !p.role);
  assert.ok(corners.every((c) => c.center[1] === 252.25 && c.center[2] === 310.25));
  const lines = rentalList(list);
  const qty = (key: string) => lines.find((l) => l.key === key)?.qty;
  assert.equal(qty("truss-120"), 56);
  assert.equal(qty("truss-60"), 8);
  assert.equal(qty("truss-48"), 8);
  assert.equal(qty("sleeve"), 8);
  assert.equal(qty("head"), 8);
  assert.equal(qty("towerbase"), 8);
  assert.equal(qty("corner"), 4);
  assert.match(rentalText("Air Pro", lines), /3 × 20\.5" box truss spacer, 7"/);
});

test("roof tower loads add up to the grid's weight, and the busiest tower is an inner one", () => {
  const design = newDesign("roof");
  const list = buildList(design);
  const loads = towerLoads(design, list);
  assert.equal(loads.length, 8);
  const total = loads.reduce((a, l) => a + l.lb, 0);
  const grid = (4726.5 / 12) * 7.5 + 4 * 32 + 8 * 95;
  assert.ok(Math.abs(total - grid) < 0.5, `${total} vs ${grid}`);
  const worst = loads.reduce((a, b) => (b.lb > a.lb ? b : a));
  assert.ok(worst.index === 1 || worst.index === 2, "the long middle bay loads the inner towers most");
  assert.ok(Math.abs(loads[0].lb - loads[3].lb) < 0.01 && Math.abs(loads[0].lb - loads[4].lb) < 0.01, "symmetric");
});

test("roof checks: long spans flagged, tower limit labelled a guess until set", () => {
  const d = newDesign("roof");
  const f = checks(d, buildList(d));
  assert.ok(f.some((x) => x.id === "span-long" && /42'4"/.test(x.text)));
  assert.ok(f.some((x) => x.id === "span-cross" && x.level === "warn"));
  assert.ok(f.some((x) => x.id === "towers" && x.level === "ok" && /planning figure/.test(x.text)));
  const tight = newDesign("roof", { towerLimit: 500 });
  assert.ok(checks(tight, buildList(tight)).some((x) => x.id === "towers" && x.level === "warn" && !/planning figure/.test(x.text)));
});

test("bays: even when the count changes, scaled when the length changes", () => {
  assert.deepEqual(fitBays([268, 508, 268], 4, 1044), [268, 508, 268]);
  assert.deepEqual(fitBays([268, 508, 268], 3, 1044), [522, 522]);
  assert.deepEqual(fitBays([268, 508, 268], 4, 1200), [308, 584, 308]);
  const e = parseEdit("bays 22'4\" 42'4\" 22'4\"");
  assert.deepEqual(e?.bays, [268, 508, 268]);
  const { design } = applyEdit(newDesign("roof", { towers: 3, bays: [] }), e!);
  assert.equal(design.params.towers, 4);
  assert.equal(design.params.width, 1044);
  assert.equal(parseEdit("ground support roof, 3 towers per side")?.towers, 3);
  assert.equal(parseEdit("no spine")?.spine, false);
  assert.equal(parseEdit("limit 3,000 lb per tower")?.towerLimit, 3000);
  assert.equal(parseEdit("self climbing roof")?.template, "roof");
});

test("switching to the roof starts on 20.5\" box even from a 12\" design", () => {
  const { design } = applyEdit(newDesign("cube"), parseEdit("ground support roof")!);
  assert.equal(design.params.series, "box20");
  assert.equal(applyEdit(newDesign("cube", { series: "box20" }), parseEdit("goal post")!).design.params.series, "box20");
  assert.equal(applyEdit(newDesign("cube"), parseEdit("goal post")!).design.params.series, "box12");
});
