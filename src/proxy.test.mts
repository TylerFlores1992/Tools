// Proxy keeps /private locked, with one exception: the Vectorworks connector's own update files
// open to its key (RIG_TOKEN) and nothing else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "./proxy.ts";

process.env.RIG_TOKEN = "rig-key-for-tests";
process.env.LAB_PASSWORD = "lab-password-for-tests";
const req = (path: string, auth?: string) => new NextRequest(`https://tylerflores.dev${path}`, { headers: auth ? { authorization: auth } : {} });
const passes = (r: Response) => r.status === 200 && r.headers.get("x-middleware-next") === "1";

test("the connector's update files open to its key", () => {
  for (const f of ["/private/vectorworks/vwmcp-win.json", "/private/vectorworks/vwmcp-win.zip", "/private/vectorworks/symbols.json"]) {
    assert.ok(passes(proxy(req(f, "Bearer rig-key-for-tests"))), f);
  }
});

test("a wrong key, no key, or the key on any other private file stays locked", () => {
  assert.equal(proxy(req("/private/vectorworks/vwmcp-win.zip", "Bearer nope")).status, 401);
  assert.equal(proxy(req("/private/vectorworks/vwmcp-win.zip")).status, 401);
  assert.equal(proxy(req("/private/money/export.csv", "Bearer rig-key-for-tests")).status, 401);
  assert.equal(proxy(req("/private/rig", "Bearer rig-key-for-tests")).status, 307);
});

test("with no RIG_TOKEN set the files stay locked even to an empty key", () => {
  const saved = process.env.RIG_TOKEN;
  delete process.env.RIG_TOKEN;
  assert.equal(proxy(req("/private/vectorworks/vwmcp-win.json", "Bearer ")).status, 401);
  assert.equal(proxy(req("/private/vectorworks/vwmcp-win.json", "Bearer undefined")).status, 401);
  process.env.RIG_TOKEN = saved;
});
