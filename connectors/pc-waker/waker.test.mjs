import { test } from "node:test";
import assert from "node:assert/strict";
import { magicPacket, makeServer, parseMac, sameKey } from "./waker.mjs";

const KEY = "k".repeat(32);
const cfg = { mac: "AA-BB-CC-DD-EE-FF", ip: "192.168.68.50", token: KEY, name: "Main PC" };

async function withServer(deps, fn) {
  const srv = makeServer(cfg, deps);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    await fn(base);
  } finally {
    srv.close();
  }
}
const H = { authorization: `Bearer ${KEY}` };

test("the magic packet is six 0xFF then the MAC sixteen times", () => {
  const p = magicPacket("aa:bb:cc:dd:ee:ff");
  assert.equal(p.length, 102);
  assert.deepEqual([...p.subarray(0, 6)], Array(6).fill(255));
  assert.deepEqual([...p.subarray(96)], [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
  assert.equal(parseMac("nope"), null);
  assert.throws(() => magicPacket("12:34"));
});

test("keys must match exactly and be long enough", () => {
  assert.ok(sameKey(KEY, KEY));
  assert.ok(!sameKey(KEY.slice(1), KEY));
  assert.ok(!sameKey("short", "short"));
});

test("nothing answers without the key, on either path shape", async () => {
  await withServer({ ping: async () => false, send: async () => {} }, async (base) => {
    for (const p of ["/status", "/pc/status", "/pc/wake"]) {
      const r = await fetch(base + p, { method: p.endsWith("wake") ? "POST" : "GET" });
      assert.equal(r.status, 401);
    }
    const bad = await fetch(base + "/status", { headers: { authorization: "Bearer " + "x".repeat(32) } });
    assert.equal(bad.status, 401);
  });
});

test("wake sends once, refuses a repeat for 15 s, and skips a PC that's already on", async () => {
  let sent = 0;
  let awake = false;
  let t = 1_000_000;
  await withServer({ ping: async () => awake, send: async () => void sent++, now: () => t }, async (base) => {
    const w1 = await (await fetch(base + "/pc/wake", { method: "POST", headers: H })).json();
    assert.equal(w1.sent, true);
    const w2 = await (await fetch(base + "/wake", { method: "POST", headers: H })).json();
    assert.equal(w2.sent, false);
    t += 20_000;
    awake = true;
    const w3 = await (await fetch(base + "/wake", { method: "POST", headers: H })).json();
    assert.equal(w3.sent, false);
    assert.equal(w3.awake, true);
    assert.equal(sent, 1);
    const s = await (await fetch(base + "/pc/status", { headers: H })).json();
    assert.equal(s.awake, true);
    assert.equal(s.name, "Main PC");
  });
});

test("only the two routes exist", async () => {
  await withServer({ ping: async () => false, send: async () => {} }, async (base) => {
    assert.equal((await fetch(base + "/files", { headers: H })).status, 404);
    assert.equal((await fetch(base + "/wake", { headers: H })).status, 404); // GET can't wake
  });
});
