// The review decisions that are recorded with the maps (decisions/wave-NN.json), so they hold in every
// browser and a build can read them: approved maps can be published, hidden ones show "not drawn yet".
// The review page's buttons still save in the browser first; the owner sends those calls and a
// session commits them here. Checked by decisions.test.mts.
import wave00 from "./decisions/wave-00.json" with { type: "json" };
import wave01 from "./decisions/wave-01.json" with { type: "json" };

export type Decision = "approved" | "roads" | "hidden";
export const DECISIONS: Decision[] = ["approved", "roads", "hidden"];
export type DecisionRecord = { id: string; decision: Decision; by: string; on: string; note: string };
export type DecisionFile = { version: 1; wave: number; source: string; decisions: DecisionRecord[] };

export const DECISION_FILES = [wave00 as DecisionFile, wave01 as DecisionFile];

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

/**
 * The decisions file for one wave (decisions/wave-NN.json), from what the review page shows: a
 * decision recorded with the maps keeps its record (who, when, why); one made on the page is
 * dated today. Only maps in the wave, in the wave's order. Returns the file and its problems
 * (decisionProblems), so the page never offers a file the tests would refuse.
 */
export function decisionsFileFor(wave: number, ids: string[], shown: Record<string, Decision>, today: string, by = "Owner (review page)"): { file: DecisionFile; problems: string[] } {
  const decisions: DecisionRecord[] = ids.filter((id) => shown[id]).map((id) => {
    const r = RECORDED[id];
    return r && r.decision === shown[id] ? r : { id, decision: shown[id], by, on: today, note: "" };
  });
  const file: DecisionFile = { version: 1, wave, source: `Downloaded from the review page, ${today}: ${decisions.length} decision${decisions.length === 1 ? "" : "s"} on wave ${wave}.`, decisions };
  return { file, problems: decisionProblems(file, new Set(ids)) };
}

/** Codes that mean the listing isn't one campground's map (spread over kilometers, sites stacked on
    one spot, or far from all the others): a person keeps it hidden until it can be split. */
const NOT_ONE_MAP = new Set(["spread", "stacked", "outlier"]);

/**
 * The decision the review page offers first for a map the first look held. A hold whose checks
 * say the listing is spread out or stacked points to "keep it hidden"; any other hold (roads
 * missing, including ones no check can see) points to "needs roads added". Anything not held
 * points to approval. The reviewer can always pick another.
 */
export function suggestedDecision(reasons: { code: string }[], look: string | undefined): Decision {
  if (look !== "hold") return "approved";
  return reasons.some((r) => NOT_ONE_MAP.has(r.code)) ? "hidden" : "roads";
}
