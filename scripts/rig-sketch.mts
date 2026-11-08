// Rig Studio sketches from the command line, for the full sessions the page starts:
//   npx tsx scripts/rig-sketch.mts check  <sketch.json> [layers.json]   problems, notes and checks
//   npx tsx scripts/rig-sketch.mts build  <sketch.json>                 the build list (for build_rig)
//   npx tsx scripts/rig-sketch.mts rental <sketch.json>                 the rental list
// A file may hold a bare sketch or a version document ({ sketch: … }). Exit 1 when it's invalid.
import { readFileSync } from "node:fs";
import { rentalList, totalWeight } from "../src/tools/rig/bom.ts";
import { compileSketch, pointLines, readSketch, sketchChecks, type SketchLoad } from "../src/tools/rig/sketch.ts";

const [cmd, file, layersFile] = process.argv.slice(2);
if (!cmd || !file) {
  console.error("usage: rig-sketch.mts check|build|rental <sketch.json> [layers.json]");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(file, "utf8"));
const r = readSketch(raw.sketch ?? raw);
if (!r.sketch) {
  console.log(JSON.stringify({ ok: false, problems: r.problems }, null, 1));
  process.exit(1);
}
const sk = r.sketch;
const c = compileSketch(sk);
const loads: SketchLoad[] = [];
if (layersFile) {
  const layers = JSON.parse(readFileSync(layersFile, "utf8"));
  for (const l of Array.isArray(layers) ? layers : [layers])
    if (l.kind === "fixtures" && l.onRig && l.visible !== false) for (const [i, f] of (l.fixtures ?? []).entries()) if (f.lb > 0) loads.push({ id: `${l.id ?? "layer"}:${i}`, at: [f.x, f.y, f.z], lb: f.lb, label: f.type ?? "Fixture" });
}
if (cmd === "build") console.log(JSON.stringify(c.list));
else if (cmd === "rental") {
  const lines = [...rentalList(c.list), ...pointLines(sk)];
  console.log(JSON.stringify({ lines, lb: Math.round(totalWeight(lines)) }, null, 1));
} else {
  const checks = sketchChecks(sk, c, loads);
  console.log(JSON.stringify({ ok: true, parts: c.list.parts.length, notes: c.list.notes, checks: checks.map((f) => `${f.level}: ${f.text}`) }, null, 1));
}
