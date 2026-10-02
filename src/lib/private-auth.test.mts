import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, passwordMatches, safeNext, verifySession, SESSION_DAYS } from "./private-auth.ts";

const PW = "trail-mix ✓";
const NOW = 1_790_000_000_000;

test("a fresh session verifies with the same password", () => {
  assert.equal(verifySession(createSession(PW, NOW), PW, NOW), true);
});

test("a session expires after SESSION_DAYS", () => {
  const t = createSession(PW, NOW);
  assert.equal(verifySession(t, PW, NOW + SESSION_DAYS * 86_400_000 - 1), true);
  assert.equal(verifySession(t, PW, NOW + SESSION_DAYS * 86_400_000), false);
});

test("changing the password signs everyone out", () => {
  assert.equal(verifySession(createSession(PW, NOW), "new password", NOW), false);
});

test("tampered, malformed or missing tokens are refused", () => {
  const t = createSession(PW, NOW);
  const [v, exp, sig] = t.split(".");
  const later = String(Number(exp) + 86_400_000 * 365);
  const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
  for (const bad of [`${v}.${later}.${sig}`, `${v}.${exp}.${flipped}`, `v2.${exp}.${sig}`, `${v}.${exp}`, "", "a.b.c", `${v}.-1.${sig}`, `${t}.extra`]) {
    assert.equal(verifySession(bad, PW, NOW), false, bad);
  }
  assert.equal(verifySession(undefined, PW, NOW), false);
  assert.equal(verifySession(t, undefined, NOW), false, "no password configured means locked");
  assert.equal(verifySession(t, "", NOW), false, "an empty password configured means locked");
});

test("with no password configured, even a token forged for an empty or missing password is refused", () => {
  assert.equal(verifySession(createSession("", NOW), "", NOW), false);
  assert.equal(verifySession(createSession("undefined", NOW), undefined, NOW), false);
});

test("passwordMatches is exact, including non-ASCII", () => {
  assert.equal(passwordMatches(PW, PW), true);
  assert.equal(passwordMatches("trail-mix", PW), false);
  assert.equal(passwordMatches(`${PW} `, PW), false);
  assert.equal(passwordMatches("", PW), false);
});

test("safeNext keeps you inside the private area and nowhere else", () => {
  const cases: [string | null | undefined, string][] = [
    ["/private", "/private"],
    ["/private/camphawk", "/private/camphawk"],
    ["/private/camphawk?x=1#pricing", "/private/camphawk?x=1#pricing"],
    ["/private/sign-in", "/private"],
    ["/privateer", "/private"],
    ["/workshop", "/private"],
    ["//evil.com/private", "/private"],
    ["/\\evil.com", "/private"],
    ["https://evil.com/private", "/private"],
    ["javascript:alert(1)", "/private"],
    ["/private/../workshop", "/private"],
    ["", "/private"],
    [null, "/private"],
    [undefined, "/private"],
  ];
  for (const [input, want] of cases) assert.equal(safeNext(input), want, String(input));
});
