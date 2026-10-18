/**
 * Runs the Gmail Apps Script against a fake Gmail and a fake server, in a vm sandbox: the only
 * way any of it runs before a real account does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { gmailScript, gmailScriptTemplate, KEY_PLACEHOLDER, URL_PLACEHOLDER } from "./gmail-script.ts";

type Msg = { id: string; inbox: boolean; trashed: boolean; labels: string[]; archived: boolean };

function harness(serverOps: (payload: Record<string, unknown>) => unknown) {
  const msgs: Msg[] = [
    { id: "m1", inbox: true, trashed: false, labels: [], archived: false },
    { id: "m2", inbox: true, trashed: false, labels: [], archived: false },
    { id: "m3", inbox: false, trashed: false, labels: [], archived: false }, // already archived: never sent
  ];
  const calls: Array<Record<string, unknown>> = [];
  const auth: string[] = [];
  const thread = (m: Msg) => ({
    addLabel: (l: { name: string }) => m.labels.push(l.name),
    moveToArchive: () => { m.archived = true; m.inbox = false; },
  });
  const wrap = (m: Msg) => ({
    getId: () => m.id,
    isInInbox: () => m.inbox,
    getFrom: () => `"Sender ${m.id}" <${m.id}@example.com>`,
    getSubject: () => `Subject ${m.id}`,
    getDate: () => new Date("2026-10-18T13:00:00Z"),
    getPlainBody: () => "x".repeat(2000),
    getHeader: (h: string) => (h === "List-Unsubscribe" ? "<https://list.example.com/u>" : ""),
    moveToTrash: () => { m.trashed = true; m.inbox = false; },
    getThread: () => thread(m),
  });
  const ctx = {
    console: { log() {}, error() {} },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
    GmailApp: {
      search: () => [{ getMessages: () => msgs.map(wrap) }],
      getMessageById: (id: string) => { const m = msgs.find((x) => x.id === id); return m ? wrap(m) : null; },
      getUserLabelByName: () => null,
      createLabel: (name: string) => ({ name }),
    },
    UrlFetchApp: {
      fetch: (_url: string, o: { payload: string; headers: { Authorization: string } }) => {
        const p = JSON.parse(o.payload);
        calls.push(p);
        auth.push(o.headers.Authorization);
        const body = serverOps(p);
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
      },
    },
    Utilities: { sleep() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(gmailScript("https://tylerflores.dev/api/mail/gmail", "k3y"), ctx);
  return { ctx, msgs, calls, auth };
}

test("the template keeps both placeholders and no backtick", () => {
  const t = gmailScriptTemplate();
  assert.ok(t.includes(URL_PLACEHOLDER) && t.includes(KEY_PLACEHOLDER));
  assert.ok(!t.includes("`"));
});

test("a run sends only new inbox mail, performs the server's moves, and reports back", () => {
  const h = harness((p) => {
    if (p.op === "hello") return { query: "in:inbox newer_than:2d", pending: [] };
    if (p.op === "need") return { need: ["m1", "m2"] };
    if (p.op === "batch") return { ops: [{ id: "m1", op: "trash" }, { id: "m2", op: "file", folder: "Misc" }] };
    return { ok: true };
  });
  const stats = vm.runInContext("morningMail()", h.ctx);
  const sent = h.calls.find((c) => c.op === "need") as { ids: string[] };
  assert.deepEqual(sent.ids, ["m1", "m2"]); // m3 was not in the inbox
  const batch = h.calls.find((c) => c.op === "batch") as { messages: Array<{ snippet: string; listUnsubscribe: string }> };
  assert.equal(batch.messages.length, 2);
  assert.equal(batch.messages[0].snippet.length, 600);
  assert.equal(batch.messages[0].listUnsubscribe, "<https://list.example.com/u>");
  assert.equal(h.msgs[0].trashed, true);
  assert.deepEqual([h.msgs[1].labels, h.msgs[1].archived], [["Misc"], true]);
  const results = h.calls.find((c) => c.op === "results") as { results: Array<{ id: string; ok: boolean }> };
  assert.deepEqual(results.results.map((r) => [r.id, r.ok]), [["m1", true], ["m2", true]]);
  assert.equal(stats.moved, 2);
  assert.ok(h.auth.every((a) => a === "Bearer k3y"));
  assert.equal(h.calls[h.calls.length - 1].op, "done");
});

test("moves left pending from an earlier day are retried from hello", () => {
  const h = harness((p) => {
    if (p.op === "hello") return { query: "q", pending: [{ id: "m2", op: "trash" }] };
    if (p.op === "need") return { need: [] };
    return { ok: true };
  });
  vm.runInContext("morningMail()", h.ctx);
  assert.equal(h.msgs[1].trashed, true);
  assert.ok(!h.calls.some((c) => c.op === "batch"));
});
