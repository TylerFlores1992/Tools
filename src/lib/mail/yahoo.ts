import "server-only";
import { ImapFlow, type ListResponse } from "imapflow";
import { simpleParser } from "mailparser";
import { rawHeader } from "@/tools/mail/headers";
import { cleanFolder } from "@/tools/mail/plan";
import type { IncomingMail, Rule } from "@/tools/mail/types";
import { ingest, opFor, type MailboxOp } from "./ingest";
import { openSecret } from "./secret";
import { markAccountRun, pendingActions, setActionStatus, type AccountRow } from "./store";

/**
 * One Yahoo account over IMAP (imap.mail.yahoo.com:993, TLS), signed in with a Yahoo APP password
 * the owner made for this, stored encrypted. Reads INBOX headers plus the first 64 KB of each new
 * message for a preview; moves mail only as the owner's rules say, and only to Trash or a folder.
 * Never deletes, never expunges, never sends.
 *
 * New mail is found by UID above a stored watermark (reset if the mailbox's UIDVALIDITY changes);
 * the first run reads the last two days.
 */

const HOST = "imap.mail.yahoo.com";
const PREVIEW_BYTES = 64 * 1024;
const MAX_PER_RUN = 300;

export function imapClient(user: string, pass: string): ImapFlow {
  return new ImapFlow({ host: HOST, port: 993, secure: true, auth: { user, pass }, logger: false, socketTimeout: 30_000, greetingTimeout: 15_000 });
}

/** Signs in and out, to check an app password before it is saved. Returns a sentence on failure. */
export async function testYahooLogin(address: string, appPassword: string): Promise<string | null> {
  const client = imapClient(address, appPassword);
  try {
    await client.connect();
    await client.logout();
    return null;
  } catch (e) {
    return describeImapError(e);
  }
}

export function describeImapError(e: unknown): string {
  const err = e as { authenticationFailed?: boolean; responseText?: string; code?: string; message?: string };
  if (err?.authenticationFailed) return "Yahoo did not accept that sign-in. Use an app password (Yahoo Account Security → Generate app password), not your normal password.";
  if (err?.code === "ETIMEDOUT" || err?.code === "ECONNRESET" || err?.code === "ENOTFOUND") return "Couldn't reach Yahoo's mail server. It will try again at the next run.";
  return `Yahoo answered: ${String(err?.responseText || err?.message || "an error").slice(0, 160)}`;
}

function trashPath(list: ListResponse[]): string {
  return list.find((m) => m.specialUse === "\\Trash")?.path ?? "Trash";
}

async function ensureFolder(client: ImapFlow, list: ListResponse[], name: string): Promise<string> {
  const want = cleanFolder(name) ?? "Misc";
  const found = list.find((m) => m.path.toLowerCase() === want.toLowerCase() || m.name.toLowerCase() === want.toLowerCase());
  if (found) return found.path;
  const created = await client.mailboxCreate(want);
  list.push({ path: created.path, name: want } as ListResponse);
  return created.path;
}

const uidOf = (id: string) => Number(id.split(":").pop());

function toIso(d: Date | string | null): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export async function syncYahoo(account: AccountRow, rules: readonly Rule[]): Promise<{ ok: boolean; stored: number; moved: number; error: string | null }> {
  if (!account.secretEnc) return { ok: false, stored: 0, moved: 0, error: "No app password saved." };
  let pass: string;
  try {
    pass = openSecret(account.secretEnc);
  } catch {
    await markAccountRun(account.id, false, "The saved app password can't be read. Add the account again.");
    return { ok: false, stored: 0, moved: 0, error: "The saved app password can't be read." };
  }
  const client = imapClient(account.address, pass);
  let stored = 0;
  let moved = 0;
  try {
    await client.connect();
    const list = await client.list();
    const lock = await client.getMailboxLock("INBOX");
    let uidValidity = 0;
    let lastUid = account.lastUid;
    try {
      const box = client.mailbox;
      uidValidity = box ? Number(box.uidValidity) : 0;
      if (account.uidValidity !== uidValidity) lastUid = null;

      let uids: number[];
      if (lastUid === null) {
        const found = await client.search({ since: new Date(Date.now() - 2 * 86_400_000) }, { uid: true });
        uids = Array.isArray(found) ? found : [];
      } else {
        const found = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
        uids = (Array.isArray(found) ? found : []).filter((u) => u > (lastUid ?? 0)); // "N:*" returns the last message when none is newer
      }
      uids = uids.sort((a, b) => a - b).slice(0, MAX_PER_RUN);

      const mails: IncomingMail[] = [];
      if (uids.length) {
        for await (const msg of client.fetch(uids, { uid: true, envelope: true, internalDate: true, headers: ["list-unsubscribe", "list-unsubscribe-post"], source: { maxLength: PREVIEW_BYTES } }, { uid: true })) {
          const headerText = msg.headers ? msg.headers.toString("utf8") : "";
          const header = (name: string) => {
            const m = headerText.match(new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\r?\\n[^\\s]|$)`, "im"));
            return m ? m[1].replace(/\r?\n\s+/g, " ").trim() : null;
          };
          let snippet = "";
          // The two header fields imapflow fetched; if Yahoo sent none back, the same lines are in
          // the first 64 KB of the message itself (no stored Yahoo email had them before this).
          let listUnsubscribe = header("list-unsubscribe");
          let listUnsubscribePost = header("list-unsubscribe-post");
          try {
            if (msg.source) {
              const parsed = await simpleParser(msg.source, { skipHtmlToText: false, skipImageLinks: true, skipTextLinks: true });
              snippet = (parsed.text ?? "").slice(0, 600);
              listUnsubscribe ??= rawHeader(parsed.headerLines, "list-unsubscribe");
              listUnsubscribePost ??= rawHeader(parsed.headerLines, "list-unsubscribe-post");
            }
          } catch {
            /* a truncated or odd message still gets its headers */
          }
          const from = msg.envelope?.from?.[0];
          mails.push({
            id: `${account.id}:${uidValidity}:${msg.uid}`,
            accountId: account.id,
            receivedAt: toIso(msg.internalDate ?? msg.envelope?.date ?? null),
            from: from ? `${from.name ? `"${from.name.replace(/"/g, "")}" ` : ""}<${from.address ?? ""}>` : "",
            subject: msg.envelope?.subject ?? "",
            snippet,
            listUnsubscribe,
            listUnsubscribePost,
          });
          lastUid = Math.max(lastUid ?? 0, msg.uid);
        }
      }

      const { stored: n } = await ingest(mails, rules);
      stored = n;

      // Every pending move for this account, including ones from rules made since the last run.
      const ops = (await pendingActions(account.id)).map(opFor).filter((o): o is MailboxOp => o !== null);
      const trash = trashPath(list);
      for (const op of ops) {
        const uid = uidOf(op.id);
        const sameBox = op.id.startsWith(`${account.id}:${uidValidity}:`);
        if (!sameBox || !Number.isFinite(uid)) {
          await setActionStatus(op.id, "failed", "Yahoo renumbered the inbox, so this one was left alone.");
          continue;
        }
        try {
          const dest = op.op === "trash" ? trash : await ensureFolder(client, list, op.folder ?? "Misc");
          const res = await client.messageMove(String(uid), dest, { uid: true });
          if (res === false) await setActionStatus(op.id, "failed", "It was no longer in the inbox.");
          else {
            await setActionStatus(op.id, "done", op.op === "trash" ? null : `Filed in ${dest}.`);
            moved++;
          }
        } catch (e) {
          await setActionStatus(op.id, "failed", describeImapError(e));
        }
      }
    } finally {
      lock.release();
    }
    await client.logout().catch(() => undefined);
    await markAccountRun(account.id, true, null, { uidValidity, lastUid });
    return { ok: true, stored, moved, error: null };
  } catch (e) {
    const msg = describeImapError(e);
    await client.logout().catch(() => undefined);
    await markAccountRun(account.id, false, msg);
    return { ok: false, stored, moved, error: msg };
  }
}
