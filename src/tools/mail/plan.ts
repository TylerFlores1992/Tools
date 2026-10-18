import { parseUnsubscribe } from "./headers.ts";
import type { ActionStatus, IncomingMail, Rule, RuleAction } from "./types.ts";

/**
 * What a matching rule does to one email. Mailbox changes happen ONLY through a rule the owner
 * made: with no rule, nothing is moved, trashed or unsubscribed. "Trash" is always a move to the
 * account's own Trash, never a permanent delete.
 */
export type Planned = {
  action: RuleAction | null;
  folder: string | null;
  status: ActionStatus | null;
  note: string | null;
};

export const DEFAULT_FOLDER = "Misc";

export function planAction(mail: IncomingMail, rule: Rule | null): Planned {
  if (!rule) return { action: null, folder: null, status: null, note: null };
  switch (rule.action) {
    case "trash":
      return { action: "trash", folder: null, status: "pending", note: null };
    case "file":
      return { action: "file", folder: cleanFolder(rule.folder) ?? DEFAULT_FOLDER, status: "pending", note: null };
    case "hide":
      return { action: "hide", folder: null, status: "done", note: null };
    case "important":
      return { action: "important", folder: null, status: "done", note: null };
    case "unsubscribe": {
      const u = parseUnsubscribe(mail.listUnsubscribe, mail.listUnsubscribePost);
      // Only a one-click (RFC 8058) link is safe to press from a server: a plain link may open a
      // page that wants a click, and a mailto would send mail as the owner, which this never does.
      if (u.oneClick) return { action: "unsubscribe", folder: null, status: "pending", note: null };
      if (u.http) return { action: "unsubscribe", folder: null, status: "manual", note: "This sender needs you to open its unsubscribe page." };
      if (u.mailto) return { action: "unsubscribe", folder: null, status: "manual", note: "This sender only unsubscribes by email, which Morning Mail never sends." };
      return { action: "unsubscribe", folder: null, status: "manual", note: "No unsubscribe link in this email." };
    }
  }
}

/** A folder name safe for Gmail labels and IMAP: printable, no path tricks, at most 60 chars. */
export function cleanFolder(raw: string | null | undefined): string | null {
  const t = (raw ?? "").replace(/[\u0000-\u001f\\"*%]/g, "").replace(/\.{2,}/g, ".").replace(/^[/.\s]+|[/.\s]+$/g, "").trim().slice(0, 60);
  return t || null;
}

/** Is this URL one a server may POST to for a one-click unsubscribe? https, a real host, no credentials. */
export function safeUnsubscribeUrl(raw: string | null): URL | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.startsWith("[")) return null; // raw IPs: never needed by a real sender
  return u;
}
