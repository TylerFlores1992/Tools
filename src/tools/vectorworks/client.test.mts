import { test } from "node:test";
import assert from "node:assert/strict";
import { PanelClient, PanelError, pairingFromHash } from "./client.ts";

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";

test("pairing links are read strictly", () => {
  assert.deepEqual(pairingFromHash(`#port=7377&token=${TOKEN}`), { port: 7377, token: TOKEN });
  assert.equal(pairingFromHash("#port=7377&token=short"), null);
  assert.equal(pairingFromHash(`#port=80&token=${TOKEN}`), null);
  assert.equal(pairingFromHash(`#port=7377&token=${TOKEN}"><script>`), null);
  assert.equal(pairingFromHash(""), null);
});

const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

test("requests go to this computer only, with the token", async () => {
  let seen: { url: string; auth: string | null } | null = null;
  const c = new PanelClient({ port: 7377, token: TOKEN }, async (url, init) => {
    seen = { url: String(url), auth: new Headers(init?.headers).get("authorization") };
    return new Response(JSON.stringify({ ok: true, result: { count: 0, objects: [] } }));
  });
  const d = await c.drawing("Lighting");
  assert.equal(d.count, 0);
  assert.deepEqual(seen, { url: "http://127.0.0.1:7377/api/drawing?layer=Lighting", auth: `Bearer ${TOKEN}` });
});

test("every failure becomes words and a kind the page can act on", async () => {
  const cases: [ConstructorParameters<typeof PanelClient>[1], PanelError["kind"], RegExp][] = [
    [async () => { throw new TypeError("Failed to fetch"); }, "offline", /vwmcp-panel running/],
    [reply(401, { error: "Wrong or missing pairing token." }), "unpaired", /pairing/],
    [reply(403, { error: "The panel can't run 'run_python'." }), "refused", /can't run/],
    [reply(422, { ok: false, error: "No object with id 'x'." }), "vectorworks", /No object/],
    [reply(504, { ok: false, error: "Vectorworks never picked up 'ping'." }), "vectorworks", /never picked up/],
  ];
  for (const [fetcher, kind, msg] of cases) {
    const c = new PanelClient({ port: 7377, token: TOKEN }, fetcher);
    await assert.rejects(c.op("ping"), (e: unknown) => e instanceof PanelError && e.kind === kind && msg.test(e.message));
  }
});
