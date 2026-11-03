/**
 * How a number field reads what's typed so far. Pure, so the rules are tested.
 *
 * - "number": a value to use ("14", "-2", "1." and "1,5" all count).
 * - "typing": on the way to a number but not one yet ("", "-", ".", "-."). The field shows no
 *   error while it has focus, and keeps the last good value; on blur it's treated as invalid.
 * - "invalid": can't become a number by typing more ("abc", "1.2.3", "--").
 */
export type Draft = { kind: "number"; n: number } | { kind: "typing" } | { kind: "invalid" };

const TYPING = /^\s*[-+]?[.,]?\s*$/;

export function readDraft(text: string): Draft {
  if (TYPING.test(text)) return { kind: "typing" };
  const n = Number(text.trim().replace(",", "."));
  return Number.isFinite(n) ? { kind: "number", n } : { kind: "invalid" };
}
