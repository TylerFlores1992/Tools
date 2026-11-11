// The chat bar: Claude inside the page, with the page's own functions as tools. It edits the rig
// directly for ordinary changes and hands big jobs to a full Claude session.
import { compileSketch, readSketch, sketchChecks, type Sketch } from "../../../src/tools/rig/sketch.ts";
import { applyOps, type SketchOp } from "../../../src/tools/rig/sketchOps.ts";
import type { SampleTool } from "./cap.ts";
import { ftIn, layerLoads, layerSummary, type Layer, type Message, type Shape } from "./model.ts";
import { drawingExtent, referenceName, referenceShapes } from "./reference.ts";

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
  /** Show or hide reference layers (the designer's view; the rig doesn't change). */
  setVisible(ids: string[], visible: boolean): Promise<void>;
  /** Add (or replace, by name) a layer of dimension lines with their figures. */
  putMeasurements(name: string, shapes: Shape[]): Promise<string>;
  /** Add or move the project's one X and Y reference layer. */
  putReference(name: string, shapes: Shape[], reference: NonNullable<Layer["reference"]>): Promise<string>;
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

Reference layers (drawings and lighting plots from the venue, Vectorworks or Dropbox): ${ctx.layers.length ? ctx.layers.map(layerSummary).join("; ") : "none yet"}. Call read_layer to get fixture positions, outlines or the existing rig before laying truss over them. When a drawing's existing rig is there and the designer asks to rebuild or copy it, turn its truss into runs (snap to whole stock, joints where pieces meet) and its hoists into points. The usual job: run truss where the fixtures hang (each fixture within about 1' of a run, at its height), then hoists so no span is over the limit, about one per 20-30' and at the corners.

How to work:
- Looking is not changing. Questions, showing or hiding layers (show_layers), reading positions (read_layer) and measuring (add_measurements: a layer of dimension lines with their figures) never touch the rig or the Vectorworks drawing and save no version. Only edit_rig/replace_rig change the rig. When the designer asks to see something or to measure, do just that.
- Every drawing is measured on site off two reference lines, X and Y (usually the center line and a beam, the plaster line, the downstage edge or a stage wall). When the designer asks for them, or there are none and you're measuring, find them with read_layer (lines or text named CL, PL, DSE, a beam, 0,0) and call set_reference; if you can't tell which lines, ask. Once set, say positions and measurements from them (12'-6" HR of CL, 8' US of Beam A) and measure off them.
- To measure a layout: read_layer the layer (give an area to zoom in on part of the drawing; each item comes with its outline's box), work out the dimensions that matter in X and Y (overall sizes, offsets from the center line and the front edge, gaps, steps between pieces), then add_measurements. Say the key figures in your answer too.
- For a change you can make with a few edits, call edit_rig (or replace_rig to redraw from scratch). Each call is checked; fix what the problems say and try again. One version is saved when you finish.
- There is one Ask button: you decide whether the job is yours or a full session's, and the designer never has to. Do it yourself when the page's tools can: questions, showing or hiding layers, reading positions, measuring, reference lines, and rig changes a handful of edit_rig calls can make. Call start_session right away, without asking first, when it needs what you don't have: opening, reading or changing a Vectorworks file, a Dropbox file the page can't open, building in Vectorworks, research on the web, or a design that needs many careful passes or more than about 10 edit_rig rounds. Also when the designer asks for a full session. Write its request in full (it doesn't see this chat), then say in one sentence that you handed it off and why. where:"pc" when it needs Vectorworks or files on the designer's computer, otherwise "cloud". Don't start a session for something you can answer.
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
      description: "Read one reference layer: fixture positions (inches, with type and weight), outlines (each with its box [x0, y0, x1, y1], height and points) or the existing rig. area [x0, y0, x1, y1] keeps only what's inside it (outlines touching it). At most 400 fixtures or 250 outlines; the reply says how many there were.",
      inputSchema: { type: "object", properties: { id: { type: "string" }, area: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 } }, required: ["id"] },
      execute(input) {
        const l = ctx.layers.find((x) => x.id === String(input.id));
        if (!l) throw new Error(`No layer ${input.id}. Layers: ${ctx.layers.map((x) => x.id).join(", ") || "none"}`);
        ctx.onProgress(`Reading ${l.name}…`);
        const r = (n: number) => Math.round(n * 10) / 10;
        if (l.kind === "fixtures") return { name: l.name, fixtures: (l.fixtures ?? []).slice(0, 400).map((f) => [r(f.x), r(f.y), r(f.z), f.lb, f.type ?? ""]), columns: "x, y, z, lb, type" };
        if (l.kind === "shapes") {
          const area = Array.isArray(input.area) && input.area.length === 4 ? (input.area as number[]) : null;
          const all = (l.shapes ?? []).filter((s) => s.pts.length);
          const box = (s: Shape) => {
            const xs = s.pts.map((p) => p[0]);
            const ys = s.pts.map((p) => p[1]);
            return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
          };
          const inside = area ? all.filter((s) => {
            const b = box(s);
            return b[2] >= area[0] && b[0] <= area[2] && b[3] >= area[1] && b[1] <= area[3];
          }) : all;
          const ext = inside.reduce((e, s) => {
            const b = box(s);
            return [Math.min(e[0], b[0]), Math.min(e[1], b[1]), Math.max(e[2], b[2]), Math.max(e[3], b[3])];
          }, [Infinity, Infinity, -Infinity, -Infinity]);
          return {
            name: l.name,
            count: inside.length,
            extent: inside.length ? ext.map(r) : null,
            shapes: inside.slice(0, 250).map((s) => ({ ...(s.label ? { label: s.label } : {}), ...(s.text ? { text: s.text } : {}), box: box(s).map(r), z: r(s.z ?? 0), ...(s.h ? { top: r((s.z ?? 0) + s.h) } : {}), closed: !!s.closed, ...(s.pts.length <= 12 ? { pts: s.pts.map(([x, y]) => [r(x), r(y)]) } : { corners: s.pts.length }) })),
          };
        }
        if (l.kind === "rig")
          return {
            name: l.name,
            note: "Truss and rigging already in the drawing. Truss: at = insertion, b = far end (when its length is known); Z is the insertion height as Vectorworks stores it, check it against the fixtures before reusing it.",
            items: (l.rig ?? []).slice(0, 400).map((it) => ({ kind: it.kind, name: it.name, at: it.at.map(r), ...(it.b ? { b: it.b.map(r) } : {}), ...(it.bbox ? { bbox: it.bbox.map(r) } : {}), fields: it.fields })),
          };
        return { name: l.name, note: `An image underlay ${ftIn(l.widthIn ?? 0)} wide. You can't see the picture; ask the designer for the positions or start a session.` };
      },
    },
    {
      name: "show_layers",
      description: "Show or hide reference layers in the designer's view (nothing in the rig or the drawing changes). only: show these and hide every other drawing layer; or show / hide lists. Ids from the layer list.",
      inputSchema: {
        type: "object",
        properties: {
          only: { type: "array", items: { type: "string" } },
          show: { type: "array", items: { type: "string" } },
          hide: { type: "array", items: { type: "string" } },
        },
      },
      async execute(input) {
        const ids = new Set(ctx.layers.map((l) => l.id));
        const pick = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
        const unknown = [...pick(input.only), ...pick(input.show), ...pick(input.hide)].filter((id) => !ids.has(id));
        if (unknown.length) throw new Error(`No layer ${unknown.join(", ")}. Layers: ${ctx.layers.map((l) => `${l.id} "${l.name}"`).join("; ")}`);
        ctx.onProgress("Changing what's shown…");
        if (Array.isArray(input.only)) {
          const only = new Set(pick(input.only));
          const drawings = ctx.layers.filter((l) => l.kind !== "fixtures" || !l.onRig);
          await ctx.setVisible(drawings.filter((l) => only.has(l.id) && !l.visible).map((l) => l.id), true);
          await ctx.setVisible(drawings.filter((l) => !only.has(l.id) && l.visible && !l.name.startsWith("Measurements:") && !l.reference).map((l) => l.id), false);
        }
        if (pick(input.show).length) await ctx.setVisible(pick(input.show), true);
        if (pick(input.hide).length) await ctx.setVisible(pick(input.hide), false);
        return { done: true, note: "Only the view changed." };
      },
    },
    {
      name: "add_measurements",
      description: "Add a layer of dimension lines (replaces the layer with the same name). Each dim: a and b are [x, y] in inches (the line is measured between them), label optional (else the length in feet and inches), offset (inches) moves the line sideways off the objects. z: height to draw them at (default the floor). Nothing in the rig or the drawing changes.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short name, e.g. \"Deck layout\"." },
          z: { type: "number" },
          dims: {
            type: "array",
            items: {
              type: "object",
              properties: { a: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, b: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, label: { type: "string" }, offset: { type: "number" } },
              required: ["a", "b"],
            },
          },
        },
        required: ["name", "dims"],
      },
      async execute(input) {
        const dims = Array.isArray(input.dims) ? (input.dims as { a: number[]; b: number[]; label?: string; offset?: number }[]) : [];
        if (!dims.length) throw new Error("No dims to draw.");
        ctx.onProgress("Drawing the measurements…");
        const z = typeof input.z === "number" ? input.z : 1;
        const shapes = dims.map((d) => measurement(d.a as [number, number], d.b as [number, number], d.label, d.offset ?? 0, z));
        const name = `Measurements: ${String(input.name).replace(/^Measurements:\s*/i, "")}`;
        await ctx.putMeasurements(name, shapes);
        return { layer: name, dims: shapes.map((s) => s.text) };
      },
    },
    {
      name: "set_reference",
      description: "Draw the X and Y reference lines the drawing is measured off on site, across the drawing with their names and a figure every step_ft feet (a layer of its own; replaces the earlier reference; nothing in the rig or the drawing changes). origin [x, y] in drawing inches is where they cross. x_line names the line running across the drawing (Y = 0 on it, e.g. \"Beam A\", \"Plaster line\", \"DS edge\"); y_line the one running up and downstage (X = 0 on it, usually \"CL\").",
      inputSchema: {
        type: "object",
        properties: {
          origin: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
          x_line: { type: "string" },
          y_line: { type: "string" },
          step_ft: { type: "number", description: "Feet between figures, default 5." },
        },
        required: ["origin", "x_line", "y_line"],
      },
      async execute(input) {
        const o = input.origin as number[];
        if (!Array.isArray(o) || o.length !== 2 || !o.every(Number.isFinite)) throw new Error("origin must be [x, y] in inches.");
        const reference = { origin: [o[0], o[1]] as [number, number], xLine: String(input.x_line).trim() || "X", yLine: String(input.y_line).trim() || "CL", stepFt: typeof input.step_ft === "number" && input.step_ft >= 1 ? input.step_ft : 5 };
        ctx.onProgress("Drawing the reference lines…");
        const shapes = referenceShapes(reference, drawingExtent(ctx.layers, reference.origin, rigPoints(ctx.sketch)));
        const name = referenceName(reference);
        await ctx.putReference(name, shapes, reference);
        return { layer: name, note: `Positions are now said from here: X is HL (-) / HR (+) of ${reference.yLine}, Y is DS (-) / US (+) of ${reference.xLine}. Subtract the origin from drawing coordinates.` };
      },
    },
    {
      name: "start_session",
      description: "Hand a job to a full Claude session (Opus, with Vectorworks on the PC or the web in the cloud). It reads this project, does the work and saves a new version; the chat shows its progress. The request must stand alone: the session doesn't see this chat. Returns the job id.",
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
  // A message that never got an answer (the connection dropped; the designer asked again) is left
  // out: otherwise Claude answers old questions on top of the new one.
  const kept = history.filter((_, i) => !unanswered(history, i));
  for (const m of kept.slice(-12)) {
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

/** A "you" message nothing answered: the next message is the designer's again, or there is none. */
export function unanswered(history: Message[], i: number): boolean {
  return history[i]?.role === "you" && (i === history.length - 1 || history[i + 1].role === "you");
}

/** A dimension line from a to b, moved `offset` inches to its left, with its figure in the middle. */
export function measurement(a: [number, number], b: [number, number], label: string | undefined, offset: number, z: number): Shape {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * offset, ny = (dx / L) * offset;
  const A: [number, number] = [a[0] + nx, a[1] + ny];
  const B: [number, number] = [b[0] + nx, b[1] + ny];
  const size = Math.max(6, Math.min(18, L / 14));
  const at: [number, number] = [(A[0] + B[0]) / 2 - (dy / L) * size * 0.9, (A[1] + B[1]) / 2 + (dx / L) * size * 0.9];
  let rot = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (rot > 90 || rot <= -90) rot += 180;
  return { pts: [at, A, B], z, closed: false, label: "", h: 0, text: label?.trim() || ftIn(L), size, rot, dim: 1, pen: "#0050c8", lw: 14 };
}

/** The rig's own points (run ends, towers, hoists), so the reference lines reach past it too. */
function rigPoints(sk: Sketch): [number, number][] {
  const out: [number, number][] = [];
  for (const r of sk.runs ?? []) out.push([r.a[0], r.a[1]], [r.b[0], r.b[1]]);
  for (const t of sk.towers ?? []) out.push([t.x, t.y]);
  for (const p of sk.points ?? []) out.push([p.at[0], p.at[1]]);
  return out;
}
