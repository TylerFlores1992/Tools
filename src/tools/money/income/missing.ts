import { normalize } from "../normalize.ts";
import type { Txn } from "../types.ts";
import type { Stub } from "./types.ts";

/**
 * "Which stubs am I missing?" Every deposit that looks like pay (a payroll company's direct
 * deposit, or a check deposited from the phone) and has no saved stub matched to it, grouped by
 * who paid it. Read from the bank, so it lists money that arrived, not work that was done (pay
 * still owed is the calendar's job).
 *
 * A deposit can sit in the data twice when the same bank CSV was imported into two accounts; a
 * copy in another account on the same day, for the same amount and description, counts once.
 */

type Payer = { key: string; name: string; test: RegExp };

/** Known payers, named the way the owner would say them. Order matters: first match wins. */
export const PAYERS: readonly Payer[] = [
  { key: "revolution", name: "Revolution Entertainment Services (OneRevolution)", test: /\bREV(OLUTION)? BUSINES|\bREVOLUTION ENT/ },
  { key: "greenslate", name: "GreenSlate", test: /\bGREEN ?SLATE\b/ },
  { key: "castandcrew", name: "Cast & Crew", test: /\bCAST (AND|&) CREW\b/ },
  { key: "ep", name: "Entertainment Partners", test: /\bENTERTAINMENT PARTNERS\b|\bEP PAYROLL\b/ },
  { key: "gep", name: "GEP Payroll Services", test: /\bGEP PAYROLL\b|\bGEP\b/ },
  { key: "takeone", name: "TakeOne", test: /\bTAKEONE\b.*\bPAYROLL\b/ },
  { key: "wrapbook", name: "Wrapbook", test: /\bWRAPBOOK\b/ },
  { key: "checks", name: "Paper checks (deposited from the phone)", test: /\b(REMOTE )?ONLINE DEPOSIT\b|\bMOBILE CHECK DEPOSIT\b|\bCHECK DEPOSIT\b/ },
];

/** Generic payroll wording, for payers not in the list (named from the bank's description). */
const GENERIC = /\bPAYROLL\b|\bPR DEPOSIT\b|\bDIRECT PAY\b|\bDIR DEP\b|\bSALARY\b/;
/** Money in that is never wages, even when it says "payroll" or "deposit". */
const NEVER = /\bEDD\b|\bIRS\b|\bTAX R(E)?F|\bFRANCHISE TAX\b|\bTRANSFER\b|\bZELLE\b|\bVENMO\b|\bSTRIPE\b|\bREFUND\b|\bREWARDS\b|\bINTEREST\b|\bPAYMENTS\b/;

export type PayerMatch = { key: string; name: string };

export function payerOf(t: Pick<Txn, "amount" | "description" | "payee">): PayerMatch | null {
  if (t.amount <= 0) return null;
  const text = normalize(`${t.description} ${t.payee ?? ""}`);
  if (NEVER.test(text)) return null;
  for (const p of PAYERS) if (p.test.test(text)) return { key: p.key, name: p.name };
  if (!GENERIC.test(text)) return null;
  const name = cleanName(t.description);
  return { key: `other:${normalize(name)}`, name };
}

/** "NEW CAPS LLC PR DEPOSIT PPD ID: 2274217142" → "New Caps LLC". */
function cleanName(description: string): string {
  const s = description
    .replace(/\bPPD ID:.*$/i, "")
    .replace(/\b(PAYROLL|PR DEPOSIT|DIRECT PAY|DIR DEP|SALARY)\b.*$/i, "")
    .trim();
  return s
    .split(/\s+/)
    .map((w) => (/^(LLC|INC|LLP|LP|CO)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ") || "Payroll deposit";
}

export type MissingDeposit = { id: string; posted: string; amount: number };
export type MissingGroup = { key: string; name: string; deposits: MissingDeposit[]; total: number };

export function missingStubs(txns: readonly Txn[], stubs: readonly Stub[], year: number): MissingGroup[] {
  const matched = new Set(stubs.filter((s) => s.status === "saved" && s.depositTxnId).map((s) => s.depositTxnId!));
  // Same day + amount + description in another account = the same deposit imported twice.
  const seen = new Map<string, { accountId: string; ids: string[] }[]>();
  const groups = new Map<string, MissingGroup>();
  const sorted = [...txns].filter((t) => !t.pending && t.posted.startsWith(`${year}-`)).sort((a, b) => a.posted.localeCompare(b.posted) || a.id.localeCompare(b.id));
  const pending: { t: Txn; payer: PayerMatch; key: string }[] = [];
  for (const t of sorted) {
    const payer = payerOf(t);
    if (!payer) continue;
    const key = `${t.posted}|${t.amount.toFixed(2)}|${normalize(t.description)}`;
    const copies = seen.get(key) ?? [];
    const mine = copies.find((c) => c.accountId === t.accountId);
    if (mine) mine.ids.push(t.id);
    else copies.push({ accountId: t.accountId, ids: [t.id] });
    seen.set(key, copies);
    pending.push({ t, payer, key });
  }
  // For each deposit key: how many real deposits (the most in any one account), how many matched.
  const done = new Set<string>();
  for (const { t, payer, key } of pending) {
    if (done.has(key)) continue;
    done.add(key);
    const copies = seen.get(key)!;
    const real = Math.max(...copies.map((c) => c.ids.length));
    const allIds = copies.flatMap((c) => c.ids);
    const matchedHere = allIds.filter((id) => matched.has(id)).length;
    const open = Math.max(0, real - matchedHere);
    if (!open) continue;
    const g = groups.get(payer.key) ?? { key: payer.key, name: payer.name, deposits: [], total: 0 };
    const ids = copies.find((c) => c.ids.length === real)!.ids.filter((id) => !matched.has(id));
    for (let i = 0; i < open; i++) g.deposits.push({ id: ids[i] ?? `${t.id}#${i}`, posted: t.posted, amount: t.amount });
    g.total = Math.round((g.total + open * t.amount) * 100) / 100;
    groups.set(payer.key, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}
