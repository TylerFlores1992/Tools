// The first project, the Air Pro self-climbing roof (tennis court, Aspect Lighting, 2022), as
// Rig Studio documents: `npx tsx studio/rig-studio/seed.mts <out.json>`. The same documents seed
// the browser tests and, through the ArtifactData tool, the published page.
import { writeFileSync } from "node:fs";
import { compileSketch, sketchFromRoof } from "../../src/tools/rig/sketch.ts";
import { newDesign } from "../../src/tools/rig/templates.ts";

export function airProDocs(at = "2026-11-07T22:00:00.000Z") {
  const d = newDesign("roof");
  const name = "Air Pro self-climber roof";
  const sketch = sketchFromRoof(name, d.params);
  const c = compileSketch(sketch);
  if (c.list.notes.length) throw new Error(c.list.notes.join("; "));
  const q = Math.round;
  return {
    "projects/air-pro-roof": {
      name,
      createdAt: at,
      updatedAt: at,
      status: "draft",
      current: 1,
      approved: null,
      built: null,
      dropbox: { path: "ns:1915330336//Pickle/Pickled/Plans/Accurate", display: "/Pickle/Pickled/Plans/Accurate" },
      seen: {},
      thumb: { r: sketch.runs.map((r) => [q(r.a[0]), q(r.a[1]), q(r.b[0]), q(r.b[1])]), t: sketch.towers.map((t) => [q(t.x), q(t.y)]), p: [] },
    },
    "projects/air-pro-roof/versions/v0001": {
      n: 1,
      note: "From the Air Pro self-climber drawing (09.07.22): 8 towers, 20.5\" box, grid at 25' trim",
      by: "claude",
      at,
      sketch,
    },
    "projects/air-pro-roof/chat/m0001": {
      role: "claude",
      text: "This is the Air Pro self-climbing roof from the 09.07.22 drawing: eight 20.5\" box towers, bays of 22'-4\", 42'-4\" and 22'-4\", grid at 25' trim with a spine. The tower limit is a planning figure until Aspect sends their calcs.",
      at,
      version: 1,
    },
  } as Record<string, Record<string, unknown>>;
}

if (process.argv[2]) {
  writeFileSync(process.argv[2], JSON.stringify(airProDocs(), null, 1));
  console.log(`wrote ${process.argv[2]}`);
}
