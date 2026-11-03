/** The pasted calendar link fetch: https, public hosts only, redirects re-checked (no SSRF). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_REDIRECTS, UnsafeLink, checkPublicUrl, fetchPublic } from "./fetch-public.ts";

const DNS: Record<string, string[]> = {
  "calendar.example": ["93.184.216.34"],
  "inside.example": ["10.0.0.5"],
  "mixed.example": ["93.184.216.34", "127.0.0.1"],
  "metadata.example": ["169.254.169.254"],
};
const lookup = async (h: string) => {
  if (!DNS[h]) throw new Error("ENOTFOUND");
  return DNS[h];
};

test("a public https link is allowed", async () => {
  const u = await checkPublicUrl("https://calendar.example/a.ics", lookup);
  assert.equal(u.hostname, "calendar.example");
});

test("http, odd ports, credentials, private hosts and IP literals are refused", async () => {
  for (const bad of [
    "http://calendar.example/a.ics",
    "https://calendar.example:8443/a.ics",
    "https://user:pw@calendar.example/a.ics",
    "https://inside.example/a.ics",
    "https://mixed.example/a.ics",
    "https://metadata.example/latest",
    "https://127.0.0.1/a.ics",
    "https://[::1]/a.ics",
    "https://[::ffff:169.254.169.254]/",
    "https://nowhere.example/",
    "not a url",
  ]) {
    await assert.rejects(checkPublicUrl(bad, lookup), UnsafeLink, bad);
  }
});

function fakeFetch(routes: Record<string, { status: number; location?: string }>) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    assert.equal(init?.redirect, "manual");
    const r = routes[url];
    if (!r) return new Response("BEGIN:VCALENDAR", { status: 200 });
    return new Response(null, { status: r.status, headers: r.location ? { location: r.location } : {} });
  }) as typeof fetch;
  return { impl, calls };
}

test("a redirect to another public host is followed", async () => {
  const f = fakeFetch({ "https://calendar.example/a.ics": { status: 302, location: "/b.ics" } });
  const res = await fetchPublic("https://calendar.example/a.ics", {}, { lookup, fetchImpl: f.impl });
  assert.equal(res.status, 200);
  assert.deepEqual(f.calls, ["https://calendar.example/a.ics", "https://calendar.example/b.ics"]);
});

test("a redirect into the private network is refused before it is fetched", async () => {
  const f = fakeFetch({ "https://calendar.example/a.ics": { status: 301, location: "https://metadata.example/latest" } });
  await assert.rejects(fetchPublic("https://calendar.example/a.ics", {}, { lookup, fetchImpl: f.impl }), UnsafeLink);
  assert.deepEqual(f.calls, ["https://calendar.example/a.ics"]);
});

test("a redirect to plain http is refused", async () => {
  const f = fakeFetch({ "https://calendar.example/a.ics": { status: 302, location: "http://calendar.example/a.ics" } });
  await assert.rejects(fetchPublic("https://calendar.example/a.ics", {}, { lookup, fetchImpl: f.impl }), UnsafeLink);
});

test("endless redirects stop", async () => {
  const routes: Record<string, { status: number; location?: string }> = {};
  for (let i = 0; i < 10; i++) routes[`https://calendar.example/${i}`] = { status: 302, location: `/${i + 1}` };
  const f = fakeFetch(routes);
  await assert.rejects(fetchPublic("https://calendar.example/0", {}, { lookup, fetchImpl: f.impl }), UnsafeLink);
  assert.equal(f.calls.length, MAX_REDIRECTS + 1);
});
