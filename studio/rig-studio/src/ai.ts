// The chat bar: Claude inside the page, with the page's own functions as tools. It edits the rig
// directly for ordinary changes and hands big jobs to a full Claude session.
import { compileSketch, readSketch, sketchChecks, type Sketch } from "../../../src/tools/rig/sketch.ts";
import { applyOps, type SketchOp } from "../../../src/tools/rig/sketchOps.ts";
import type { SampleTool } from "./cap.ts";
import { ftIn, layerLoads, layerSummary, type Layer, type Message } from "./model.ts";

export const FORMAT = `RIG FORMAT (inches; X to the right, Y away from the audience/front, Z up, floor Z=0):
- runs: truss lines {id, a:[x,y,z], b:[x,y,z], label?}. a and b are JOINT CENTERS on the truss centerline. Where run ends meet, the page adds the corner block (or a straight joint if two runs continue in a line) and fills the run with stock sections. Grid truss: Z is the centerline (trim to the bottom chord + half the truss height). Keep runs level along X or Y, or plumb (vertical legs from Z=0): Vectorworks can only build those.
- towers: ground-support self-climbing towers {id, x, y, height?}. A tower under a joint gets a sleeve block there, a base and a head block; height is worked out if left out.
- points: hanging points {id, at:[x,y,z], kind:"hoist"|"deadhang", capacity (lb, 2000 = 1 ton)}. Put them on truss joints or along runs.
- loads: other hung weight {id, at, lb, label} (speakers, video, a drape).
- series: "box12" (12" box truss, 4.3 lb/ft) or "box20" (20.5" box, 7.5 lb/ft). New projects start on box12 only as a placeholder: the designer picks the truss in the chat (edit_rig set series), and not every project uses truss. Stock lengths 10', 8', 5', 4', 2.5', 2', 1' (plus 7" and ½" spacers on 20.5"). Make joint-to-joint lengths add up: block size (12 or 20.5) plus whole stock.
- Span guide: 12" box ≤ 30' between points, 20.5" box ≤ 40'. Cantilevers ≤ 4'.`;

export type Ctx = {
  sketch: Sketch;
  layers: Layer[];
  history: Message[];
  projectName: string;
  /** Called with each new working sketch so the view updates while Claude works. */
  onDraft(s: Sketch, note: string): void;
  onProgress(text: string): void;
  startSession(request: string, where: "cloud" | "pc"): Promise<string>;
};

function summary(sk: Sketch, layers: Layer[]): string {
  const c = compileSketch(sk);
  const checks = sketchChecks(sk, c, layerLoads(layers));
  return JSON.stringify({
    sketch: sk,
    checks: checks.map((f) => `${f.level}: ${f.text}`),
  });
}

export function systemPrompt(ctx: Ctx): string {
  return `You are Claude, working inside Rig Studio, a page where a lighting and rigging designer lays out truss rigs. Project: "${ctx.projectName}". Every project starts blank.

${FORMAT}

Reference layers (drawings and lighting plots from the venue, Vectorworks or Dropbox): ${ctx.layers.length ? ctx.layers.map(layerSummary).join("; ") : "none yet"}. Call read_layer to get fixture positions or outlines before laying truss over them. The usual job: run truss where the fixtures hang (each fixture within about 1' of a run, at its height), then hoists so no span is over the limit, about one per 20-30' and at the corners.

How to work:
- For a change you can make with a few edits, call edit_rig (or replace_rig to redraw from scratch). Each call is checked; fix what the problems say and try again. One version is saved when you finish.
- For big jobs, call start_session instead and say you did: reading a Vectorworks file, working through a Dropbox file the page can't open, building in Vectorworks, or a design that needs many careful passes. where:"pc" when it needs Vectorworks or files on the designer's computer, otherwise "cloud".
- Then answer in 1-3 short plain sentences: what changed and anything to check. Feet and inches (22'-4"). No markdown headings.

Current rig: ${summary(ctx.sketch, ctx.layers)}`;
}

const vec = { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 };

export function tools(ctx: Ctx, state: { sketch: Sketch; changed: boolean; notes: string[] }): SampleTool[] {
  const after = () => {
    const c = compileSketch(state.sketch);
    return { checks: sketchChecks(state.sketch, c, layerLoads(ctx.layers)).map((f) => `${f.level}: ${f.text}`), parts: c.list.parts.length };
  };
  return [
    {
      name: "edit_rig",
      description: "Apply edits to the rig in order. Returns the checks afterwards, or problems (nothing applied). New ids are r1.., t1.., p1.., l1.. if you leave id out.",
      inputSchema: {
        type: "object",
        properties: {
          note: { type: "string", description: "A few words for the version history." },
          ops: {
            type: "array",
            items: {
              type: "object",
              properties: {
                op: { enum: ["add_run", "add_tower", "add_point", "add_load", "remove", "move", "update", "set", "clear"] },
                id: { type: "string" },
                ids: { type: "array", items: { type: "string" } },
                a: vec,
                b: vec,
                at: vec,
                by: vec,
                x: { type: "number" },
                y: { type: "number" },
                height: { type: "number" },
                kind: { enum: ["hoist", "deadhang"] },
                capacity: { type: "number" },
                lb: { type: "number" },
                label: { type: "string" },
                name: { type: "string" },
                series: { enum: ["box12", "box20"] },
                towerLimit: { type: "number" },
              },
              required: ["op"],
            },
          },
        },
        required: ["ops"],
      },
      execute(input) {
        const ops = (Array.isArray(input.ops) ? input.ops : []) as SketchOp[];
        ctx.onProgress(`Editing the rig (${ops.length} change${ops.length === 1 ? "" : "s"})…`);
        const r = applyOps(state.sketch, ops);
        if ("problems" in r) throw new Error(r.problems.join("; "));
        state.sketch = r.sketch;
        state.changed = true;
        state.notes.push(String(input.note ?? r.changes.join(", ")));
        ctx.onDraft(state.sketch, state.notes.join("; "));
        return { ok: true, changes: r.changes, ...after() };
      },
    },
    {
      name: "replace_rig",
      description: "Replace the whole rig with a new sketch object (name, series, runs, towers, points, loads, towerLimit). Use for a fresh layout. Returns the checks or the problems.",
      inputSchema: { type: "object", properties: { note: { type: "string" }, sketch: { type: "object" } }, required: ["sketch"] },
      execute(input) {
        ctx.onProgress("Drawing a new layout…");
        const r = readSketch({ name: state.sketch.name, series: state.sketch.series, ...(input.sketch as object) });
        if (!r.sketch) throw new Error(r.problems.join("; "));
        state.sketch = r.sketch;
        state.changed = true;
        state.notes.push(String(input.note ?? "new layout"));
        ctx.onDraft(state.sketch, state.notes.join("; "));
        return { ok: true, ...after() };
      },
    },
    {
      name: "read_layer",
      description: "Read one reference layer in full: fixture positions (inches, with type and weight) or outline points. Returns at most 400 fixtures.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      execute(input) {
        const l = ctx.layers.find((x) => x.id === String(input.id));
        if (!l) throw new Error(`No layer ${input.id}. Layers: ${ctx.layers.map((x) => x.id).join(", ") || "none"}`);
        ctx.onProgress(`Reading ${l.name}…`);
        const r = (n: number) => Math.round(n * 10) / 10;
        if (l.kind === "fixtures") return { name: l.name, fixtures: (l.fixtures ?? []).slice(0, 400).map((f) => [r(f.x), r(f.y), r(f.z), f.lb, f.type ?? ""]), columns: "x, y, z, lb, type" };
        if (l.kind === "shapes") return { name: l.name, shapes: (l.shapes ?? []).slice(0, 200).map((s) => ({ label: s.label, z: s.z ?? 0, closed: !!s.closed, pts: s.pts.map(([x, y]) => [r(x), r(y)]) })) };
        return { name: l.name, note: `An image underlay ${ftIn(l.widthIn ?? 0)} wide. You can't see the picture; ask the designer for the positions or start a session.` };
      },
    },
    {
      name: "start_session",
      description: "Start a full Claude session for a big job. It reads this project, does the work and saves a new version; the page shows its progress. Returns the job id.",
      inputSchema: {
        type: "object",
        properties: { request: { type: "string", description: "What to do, in full, as the designer would say it." }, where: { enum: ["cloud", "pc"] } },
        required: ["request", "where"],
      },
      async execute(input) {
        const where = input.where === "pc" ? "pc" : "cloud";
        ctx.onProgress(where === "pc" ? "Starting a session on your PC…" : "Starting a session…");
        const id = await ctx.startSession(String(input.request), where);
        return { started: true, job: id };
      },
    },
  ];
}

/** The chat so far, as turns Claude reads (newest last), ending on the new request. */
export function turns(history: Message[], request: string): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history.slice(-12)) {
    const role = m.role === "you" ? "user" : "assistant";
    const text = m.role === "session" ? `[Full session] ${m.text}` : m.text;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += `\n\n${text}`;
    else out.push({ role, content: text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (out.length && out[out.length - 1].role === "user") out[out.length - 1].content += `\n\n${request}`;
  else out.push({ role: "user", content: request });
  return out;
}
