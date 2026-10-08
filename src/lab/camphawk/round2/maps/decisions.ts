// The review decisions that are recorded with the maps (decisions/wave-NN.json), so they hold in every
// browser and a build can read them: approved maps can be published, hidden ones show "not drawn yet".
// The review page's buttons still save in the browser first; the owner sends those calls and a
// session commits them here. Checked by decisions.test.mts.
import wave00 from "./decisions/wave-00.json" with { type: "json" };

export type Decision = "approved" | "roads" | "hidden";
export const DECISIONS: Decision[] = ["approved", "roads", "hidden"];
export type DecisionRecord = { id: string; decision: Decision; by: string; on: string; note: string };
export type DecisionFile = { version: 1; wave: number; source: string; decisions: DecisionRecord[] };

export const DECISION_FILES = [wave00 as DecisionFile];

/** Every recorded decision by map id (a later wave's file wins). */
export const RECORDED: Record<string, DecisionRecord> = Object.fromEntries(
  DECISION_FILES.flatMap((f) => f.decisions).map((d) => [d.id, d]),
);

/** What's wrong with a decisions file, given the ids of the maps it may decide. Empty when fine. */
export function decisionProblems(file: DecisionFile, mapIds: Set<string>): string[] {
  const out: string[] = [];
  if (file.version !== 1) out.push(`version ${file.version} (expected 1)`);
  if (!file.source?.trim()) out.push("no source (who decided, and how)");
  const seen = new Set<string>();
  for (const d of file.decisions) {
    if (!mapIds.has(d.id)) out.push(`${d.id}: not a map in this wave`);
    if (seen.has(d.id)) out.push(`${d.id}: decided twice`);
    seen.add(d.id);
    if (!DECISIONS.includes(d.decision)) out.push(`${d.id}: unknown decision "${d.decision}"`);
    if (!d.by?.trim()) out.push(`${d.id}: no "by"`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.on ?? "")) out.push(`${d.id}: "on" is not a date`);
  }
  return out;
}
