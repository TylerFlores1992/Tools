import "server-only";
import { mergeAi } from "@/tools/mail/ai";
import { classify, mailFromStored, pickRule } from "@/tools/mail/classify";
import { clip, parseFrom, parseUnsubscribe } from "@/tools/mail/headers";
import { planAction, safeUnsubscribeUrl } from "@/tools/mail/plan";
import { addDays, CARRY_DAYS } from "@/tools/mail/report";
import type { IncomingMail, MailRow, Rule } from "@/tools/mail/types";
import { aiSort } from "./ai-sort";
import { insertMessage, knownIds, recordUnsubscribed, recentUnactioned, setActionStatus, setClassification, unactionedFrom } from "./store";

/** What a source must do to its mailbox next. "trash" always means the account's own Trash. */
export type MailboxOp = { id: string; op: "trash" | "file"; folder: string | null };

export const pacificDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/**
 * Presses a one-click (RFC 8058) unsubscribe: a POST with the body the standard specifies, no
 * cookies, no redirects followed, 10 s. Anything but a 2xx is a failure we report, never retry.
 */
export async function oneClickUnsubscribe(url: string | null): Promise<{ ok: boolean; note: string }> {
  const u = safeUnsubscribeUrl(url);
  if (!u) return { ok: false, note: "The unsubscribe link was not one a server can safely press." };
  try {
    const res = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "MorningMail/1 (one-click unsubscribe)" },
      body: "List-Unsubscribe=One-Click",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 200 && res.status < 400) return { ok: true, note: "Unsubscribed with the sender's one-click link." };
    return { ok: false, note: `The sender's unsubscribe link answered ${res.status}.` };
  } catch {
    return { ok: false, note: "The sender's unsubscribe link did not answer." };
  }
}

/** Mailbox op for a row whose action is still pending, or null if it needs none. */
export function opFor(row: Pick<MailRow, "id" | "action" | "actionFolder" | "actionStatus">): MailboxOp | null {
  if (row.actionStatus !== "pending") return null;
  if (row.action === "trash" || row.action === "unsubscribe") return { id: row.id, op: "trash", folder: null };
  if (row.action === "file") return { id: row.id, op: "file", folder: row.actionFolder };
  return null;
}

/**
 * Classifies and stores new mail, presses one-click unsubscribes the owner's rules ask for, and
 * returns the mailbox moves the source must make. Mail already stored is skipped.
 */
export async function ingest(mails: IncomingMail[], rules: readonly Rule[], reportDate = pacificDate()): Promise<{ stored: number; ops: MailboxOp[] }> {
  const known = await knownIds(mails.map((m) => m.id));
  const fresh = mails.filter((m) => !known.has(m.id));
  const ai = await aiSort(fresh, 18_000);
  const ops: MailboxOp[] = [];
  let stored = 0;
  for (const m of fresh) {
    const sender = parseFrom(m.from);
    const rule = pickRule(rules, m.from, m.subject);
    const verdict = ai.get(m.id);
    const c = mergeAi(m, classify(m, rule), verdict, rule);
    const p = planAction(m, rule);
    const u = parseUnsubscribe(m.listUnsubscribe, m.listUnsubscribePost);
    let status = p.status;
    let note = p.note;
    if (p.action === "unsubscribe" && p.status === "pending") {
      const r = await oneClickUnsubscribe(u.http);
      note = r.note;
      if (r.ok) {
        if (sender.addr) await recordUnsubscribed(sender.addr, "one-click");
      } else status = "failed";
    }
    const inserted = await insertMessage({
      id: m.id, accountId: m.accountId, reportDate, receivedAt: m.receivedAt, fromName: sender.name, fromAddr: sender.addr,
      subject: clip(m.subject || "(no subject)", 200), snippet: clip(m.snippet, 400), unsubHttp: u.http, unsubMailto: u.mailto, oneClick: u.oneClick,
      bucket: c.bucket, level: c.level, title: c.title, detail: c.detail, ruleId: rule?.id ?? null, action: p.action,
      actionFolder: p.folder, actionStatus: status, actionNote: note, sortedBy: verdict && !rule ? "ai" : "code",
    });
    if (!inserted) continue;
    stored++;
    const op = opFor({ id: m.id, action: p.action, actionFolder: p.folder, actionStatus: status });
    if (op) ops.push(op);
  }
  return { stored, ops };
}

/**
 * A rule made from the report applies to that sender's mail in the report (the last week) too.
 * Returns how many emails it touched and which accounts now have a mailbox move waiting.
 */
export async function applyRuleToRecent(rule: Rule, fromAddr: string): Promise<{ touched: number; accounts: string[] }> {
  const rows = await unactionedFrom(fromAddr, addDays(pacificDate(), -(CARRY_DAYS - 1)));
  const accounts = new Set<string>();
  for (const r of rows) {
    const mail = mailFromStored(r);
    const p = planAction(mail, rule);
    let status = p.status;
    let note = p.note;
    if (p.action === "unsubscribe" && p.status === "pending") {
      const res = await oneClickUnsubscribe(r.unsubHttp);
      note = res.note;
      if (res.ok) await recordUnsubscribed(fromAddr, "one-click");
      else status = "failed";
    }
    if (p.action && status) {
      await setActionStatus(r.id, status, note, p.action, p.folder);
      if (status === "pending") accounts.add(r.accountId);
    }
  }
  return { touched: rows.length, accounts: [...accounts] };
}

/**
 * Sorts the last week's mail again with today's classifier and rules: what the owner presses after
 * the sorting improves. Only the bucket, level, title and detail change; nothing in a mailbox
 * moves, and mail a rule already acted on is left as it is.
 */
export async function resortRecent(rules: readonly Rule[], days = 7): Promise<{ checked: number; changed: number }> {
  const rows = await recentUnactioned(addDays(pacificDate(), -(days - 1)));
  const mails = rows.map(mailFromStored);
  const ai = await aiSort(mails);
  let changed = 0;
  for (const [i, r] of rows.entries()) {
    const mail = mails[i];
    const rule = pickRule(rules, mail.from, mail.subject);
    const verdict = ai.get(mail.id);
    const c = mergeAi(mail, classify(mail, rule), verdict, rule);
    const by = verdict && !rule ? "ai" : "code";
    if (c.bucket === r.bucket && c.level === r.level && c.title === r.title && c.detail === r.detail && r.sortedBy === by) continue;
    await setClassification(r.id, c, by);
    if (c.bucket !== r.bucket) changed++; // "moved" means a different section, not a reworded line
  }
  return { checked: rows.length, changed };
}
