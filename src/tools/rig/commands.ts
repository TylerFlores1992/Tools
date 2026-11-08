// Plain-words edits that don't need AI: "10x10x10 cube", "make it 12 feet tall", "20.5 box",
// "remove the bottom pipes". Anything this can't read goes to the AI (src/lib/rig/ai.ts), whose
// answer is checked with the same `applyEdit`.
import { autoName, clampParams, ftIn, newDesign, template } from "./templates.ts";
import type { BraceMode, RailMode, RigDesign, RigParams, TemplateId } from "./types.ts";
import { z } from "zod";

/** One edit, in the shape the AI is asked for too. Lengths in inches. */
export const EDIT_SCHEMA = z.object({
  template: z.enum(["cube", "goalpost", "tower", "flown", "stage"]).nullable(),
  width: z.number().nullable(),
  depth: z.number().nullable(),
  height: z.number().nullable(),
  trim: z.number().nullable(),
  series: z.enum(["box12", "box20"]).nullable(),
  braces: z.enum(["none", "top", "bottom", "both"]).nullable(),
  braceLength: z.number().nullable(),
  skirt: z.boolean().nullable(),
  rail: z.enum(["none", "back", "three"]).nullable(),
  stairs: z.number().nullable(),
  reply: z.string(),
});
export type RigEdit = z.infer<typeof EDIT_SCHEMA>;

const EMPTY: RigEdit = { template: null, width: null, depth: null, height: null, trim: null, series: null, braces: null, braceLength: null, skirt: null, rail: null, stairs: null, reply: "" };

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const UNIT = String.raw`\s*(ft|feet|foot|'|in|inch|inches|")?`;

/** A number in feet unless it says inches. */
const toIn = (n: string, unit?: string) => (unit && /^(in|inch|inches|")$/.test(unit) ? Number(n) : Number(n) * 12);

/** Reads what it can from a message. Returns null when it understood nothing. */
export function parseEdit(message: string): RigEdit | null {
  const m = message.toLowerCase().replace(/[’`]/g, "'").replace(/[“”]/g, '"');
  const e: RigEdit = { ...EMPTY };
  let hit = false;
  const set = <K extends keyof RigEdit>(k: K, val: RigEdit[K]) => {
    e[k] = val;
    hit = true;
  };

  if (/goal ?post/.test(m)) set("template", "goalpost");
  else if (/\btower\b|\bmast\b/.test(m)) set("template", "tower");
  else if (/\bgrid\b|\bflown\b/.test(m)) set("template", "flown");
  else if (/\bcube\b|\bbox frame\b/.test(m)) set("template", "cube");
  else if (/\bstage\b|\bdecks?\b|\bdecking\b|\bplatform\b|\briser\b/.test(m)) set("template", "stage");
  else if (/\bhung\b|\bhang\b/.test(m) && !/skirt/.test(m)) set("template", "flown");

  const series20 = /\b20(\.5)?\s*(in|inch|")?\s*box\b|\b20\.5\b/.test(m);
  const series12 = /\b12\s*(in|inch|")?\s*box\b/.test(m);
  if (series20) set("series", "box20");
  else if (series12) set("series", "box12");

  const dims = new RegExp(`${NUM}${UNIT}\\s*(?:x|by|×)\\s*${NUM}${UNIT}(?:\\s*(?:x|by|×)\\s*${NUM}${UNIT})?`).exec(m);
  if (dims) {
    const a = toIn(dims[1], dims[2]);
    const b = toIn(dims[3], dims[4]);
    const c = dims[5] ? toIn(dims[5], dims[6]) : null;
    if (c !== null) {
      set("width", a);
      set("depth", b);
      set("height", c);
    } else {
      set("width", a);
      // Two numbers: span × height for a goal post, width × depth otherwise.
      if (e.template === "goalpost") set("height", b);
      else set("depth", b);
    }
  }

  const word = (w: string) => new RegExp(`${NUM}${UNIT}\\s*(?:${w})`).exec(m);
  const tall = word("tall|high");
  if (tall) set("height", toIn(tall[1], tall[2]));
  const wide = word("wide|span|long");
  if (wide) set("width", toIn(wide[1], wide[2]));
  const deep = word("deep");
  if (deep) set("depth", toIn(deep[1], deep[2]));
  const trim = new RegExp(`(?:trim(?:\\s+(?:it\\s+)?(?:at|to))?|hang(?:\\s+it)?\\s+at|at)\\s+${NUM}${UNIT}`).exec(m);
  if (trim && (e.template === "flown" || /trim|hang/.test(m))) set("trim", toIn(trim[1], trim[2]));
  const pipe = new RegExp(`${NUM}${UNIT}\\s*(?:pipes?|braces?)`).exec(m);
  if (pipe) set("braceLength", toIn(pipe[1], pipe[2]));

  const pipes = String.raw`(?:knee\s+)?(?:braces?|pipes?|45'?s)`;
  let braces: BraceMode | null = null;
  if (new RegExp(`\\b(?:no|remove(?: all)?(?: the)?|delete(?: all)?(?: the)?|take (?:off|out)(?: the)?|without)\\s+(?:all\\s+)?${pipes}`).test(m)) braces = "none";
  if (new RegExp(`(?:remove|delete|drop|take (?:off|out)|no|lose)(?: the)?\\s+bottom\\s+${pipes}|top\\s+${pipes}?\\s*only|only\\s+(?:on\\s+)?(?:the\\s+)?top`).test(m)) braces = "top";
  if (new RegExp(`(?:remove|delete|drop|take (?:off|out)|no|lose)(?: the)?\\s+top\\s+${pipes}|bottom\\s+${pipes}?\\s*only|only\\s+(?:on\\s+)?(?:the\\s+)?bottom`).test(m)) braces = "bottom";
  if (new RegExp(`${pipes}\\s+(?:top and bottom|both|everywhere|at (?:each|every) corner)|(?:each|every|all) corners?`).test(m)) braces = "both";
  if (braces === null && new RegExp(`add(?: the)?\\s+bottom\\s+${pipes}`).test(m)) braces = "bottom-add" as BraceMode;
  if (braces === null && new RegExp(`add(?: the)?\\s+top\\s+${pipes}|add\\s+${pipes}|with\\s+${pipes}`).test(m)) braces = "top-add" as BraceMode;
  if (braces) set("braces", braces);

  // Stage extras.
  if (/\b(?:no|remove|lose|without|drop)\s+(?:the\s+)?skirt(?:ing|s)?\b/.test(m)) set("skirt", false);
  else if (/\bskirt(?:ing|ed|s)?\b/.test(m)) set("skirt", true);
  if (/\b(?:no|remove|lose|without|drop)\s+(?:the\s+)?(?:guard\s*)?rail(?:s|ing)?\b/.test(m)) set("rail", "none");
  else if (/\b(?:guard\s*)?rail(?:s|ing)?\b/.test(m)) set("rail", /\b(?:back|upstage)\b/.test(m) && !/\bsides?\b/.test(m) ? "back" : "three");
  const stairWord = String.raw`(?:stairs|stair units?|sets? of stairs)`;
  if (new RegExp(`\\b(?:no|remove|lose|without|drop)\\s+(?:the\\s+)?${stairWord}`).test(m)) set("stairs", 0);
  else {
    const n = new RegExp(`\\b(one|two|1|2)\\s+${stairWord}`).exec(m);
    if (n) set("stairs", /^(two|2)$/.test(n[1]) ? 2 : 1);
    else if (new RegExp(`\\b(?:add|with|needs?|put)\\b[^.]*\\b(?:${stairWord}|steps)\\b`).test(m)) set("stairs", 1);
  }

  return hit ? e : null;
}

/** Applies an edit to a design, keeping every value inside its template's limits. */
export function applyEdit(design: RigDesign, edit: RigEdit): { design: RigDesign; changes: string[] } {
  const t: TemplateId = edit.template ?? design.template;
  let params: RigParams = t === design.template ? { ...design.params } : { ...template(t).defaults, series: design.params.series };
  const changes: string[] = [];
  if (t !== design.template) changes.push(`Switched to a ${template(t).name.toLowerCase()}`);
  const lengths = ["width", "depth", "height", "trim", "braceLength"] as const;
  for (const k of lengths) {
    const val = edit[k];
    if (val !== null && Number.isFinite(val) && val > 0) params[k] = val;
  }
  if (edit.series) params.series = edit.series;
  let b = edit.braces as string | null;
  if (b === "bottom-add") b = params.braces === "top" || params.braces === "both" ? "both" : "bottom";
  if (b === "top-add") b = params.braces === "bottom" || params.braces === "both" ? "both" : "top";
  if (b) params.braces = b as BraceMode;
  if (edit.skirt !== null) params.skirt = edit.skirt;
  if (edit.rail) params.rail = edit.rail;
  if (edit.stairs !== null && Number.isFinite(edit.stairs)) params.stairs = edit.stairs;
  params = clampParams(t, params);
  const before = design.params;
  for (const k of lengths) if (params[k] !== before[k] && template(t).fields.some((f) => f.key === k)) changes.push(`${label(k)} ${ftIn(params[k])}`);
  if (params.series !== before.series) changes.push(params.series === "box20" ? '20.5" box truss' : '12" box truss');
  if (params.braces !== before.braces && template(t).fields.some((f) => f.key === "braces")) changes.push(`knee braces: ${params.braces}`);
  if (params.skirt !== before.skirt && t === "stage") changes.push(params.skirt ? "skirt on" : "no skirt");
  if (params.rail !== before.rail && t === "stage") changes.push(`guardrails: ${RAIL_WORDS[params.rail]}`);
  if (params.stairs !== before.stairs && t === "stage") changes.push(params.stairs ? `${params.stairs} stair unit${params.stairs > 1 ? "s" : ""}` : "no stairs");
  const keepName = design.name !== autoName(design.template, design.params);
  return { design: { version: 1, template: t, params, name: keepName ? design.name : autoName(t, params) }, changes };
}

export const RAIL_WORDS: Record<RailMode, string> = { none: "none", back: "back only", three: "back and sides" };

const label = (k: string) => ({ width: "width", depth: "depth", height: "height", trim: "trim", braceLength: "brace pipe" })[k] ?? k;

export { newDesign };
