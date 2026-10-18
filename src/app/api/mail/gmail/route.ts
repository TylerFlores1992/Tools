import { timingSafeEqual } from "node:crypto";
import { isConfigured } from "@/lib/money/db";
import { ingest, opFor, type MailboxOp } from "@/lib/mail/ingest";
import { sha256 } from "@/lib/mail/secret";
import { getGmailSettings, getRules, markAccountRun, pendingActions, recordGmailRun, setActionStatus, knownIds } from "@/lib/mail/store";
import type { IncomingMail } from "@/tools/mail/types";

/**
 * The Gmail Apps Script talks to this. Public by path; the key (stored as SHA-256 only, made on
 * /private/mail/settings) is the entire access control, and a new key stops the old script.
 * Answers with counts and mailbox moves, never with stored mail.
 */
export const maxDuration = 60;

const QUERY = "in:inbox newer_than:2d";
const strip = (id: string) => id.replace(/^gmail:/, "");
const forScript = (op: MailboxOp) => ({ id: strip(op.id), op: op.op, folder: op.folder });

async function authorized(req: Request): Promise<boolean> {
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given) return false;
  const { keyHash } = await getGmailSettings();
  if (!keyHash) return false;
  const a = Buffer.from(sha256(given));
  const b = Buffer.from(keyHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  if (!isConfigured()) return json({ error: "not configured" }, 503);
  if (!(await authorized(req))) return json({ error: "unauthorized" }, 401);
  let p: Record<string, unknown>;
  try {
    p = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  switch (p.op) {
    case "hello": {
      const pending = (await pendingActions("gmail")).map(opFor).filter((o): o is MailboxOp => o !== null).map(forScript);
      return json({ query: QUERY, maxThreads: 200, pending });
    }
    case "need": {
      const ids = (Array.isArray(p.ids) ? p.ids : []).filter((x): x is string => typeof x === "string").slice(0, 1000);
      const known = await knownIds(ids.map((i) => `gmail:${i}`));
      return json({ need: ids.filter((i) => !known.has(`gmail:${i}`)) });
    }
    case "batch": {
      const raw = Array.isArray(p.messages) ? p.messages.slice(0, 50) : [];
      const mails: IncomingMail[] = raw
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && typeof (m as { id?: unknown }).id === "string")
        .map((m) => ({
          id: `gmail:${String(m.id).slice(0, 64)}`,
          accountId: "gmail",
          receivedAt: typeof m.date === "string" ? m.date : null,
          from: String(m.from ?? "").slice(0, 300),
          subject: String(m.subject ?? "").slice(0, 500),
          snippet: String(m.snippet ?? "").slice(0, 1000),
          listUnsubscribe: typeof m.listUnsubscribe === "string" ? m.listUnsubscribe.slice(0, 2000) : null,
          listUnsubscribePost: typeof m.listUnsubscribePost === "string" ? m.listUnsubscribePost.slice(0, 200) : null,
        }));
      const { stored, ops } = await ingest(mails, await getRules());
      return json({ stored, ops: ops.map(forScript) });
    }
    case "results": {
      const results = Array.isArray(p.results) ? p.results.slice(0, 500) : [];
      for (const r of results as Array<{ id?: unknown; ok?: unknown; error?: unknown }>) {
        if (typeof r?.id !== "string") continue;
        const id = `gmail:${r.id}`;
        if (r.ok === true) await setActionStatus(id, "done", null);
        else await setActionStatus(id, "failed", `Gmail said: ${String(r.error ?? "it could not move this email").slice(0, 160)}`);
      }
      return json({ ok: true });
    }
    case "done": {
      await recordGmailRun(p.summary ?? null);
      await markAccountRun("gmail", true, null);
      return json({ ok: true });
    }
    default:
      return json({ error: "unknown op" }, 400);
  }
}
