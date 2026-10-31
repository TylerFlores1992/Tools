import { test } from "node:test";
import assert from "node:assert/strict";
import { geminiKey, readFailureMessage, readRoute } from "./read-models.ts";

test("the Money key wins, Mail's key is the fallback, none means the gateway", () => {
  assert.equal(geminiKey({ MONEY_GEMINI_API_KEY: "m", MAIL_GEMINI_API_KEY: "x" }), "m");
  assert.equal(geminiKey({ MAIL_GEMINI_API_KEY: "x" }), "x");
  assert.equal(geminiKey({ MONEY_GEMINI_API_KEY: "" }), undefined);
  assert.deepEqual(readRoute({}), { via: "gateway", models: ["google/gemini-2.5-flash"] });
  assert.deepEqual(readRoute({ MONEY_STUB_MODEL: "openai/x" }).models, ["openai/x"]);
});

test("with a key: Gemini models, full Flash first, the override first and never twice", () => {
  const r = readRoute({ MAIL_GEMINI_API_KEY: "x" });
  assert.equal(r.via, "gemini");
  assert.deepEqual(r.models, ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"]);
  assert.deepEqual(readRoute({ MAIL_GEMINI_API_KEY: "x", MONEY_GEMINI_MODEL: "gemini-3.5-flash-lite" }).models, ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-lite-latest"]);
  for (const m of r.models) assert.ok(!m.includes("/"), `${m} must be a bare Gemini id, not a gateway string`);
});

test("a failed read says what actually happened", () => {
  // The real 2026-10-31 error from the gateway.
  assert.match(readFailureMessage({ name: "GatewayInternalServerError", message: "A positive credit balance is required to use this model" }), /out of credit/);
  assert.match(readFailureMessage({ name: "AI_APICallError", message: "Resource has been exhausted (e.g. check quota). 429" }), /free AI reads are used up/);
  assert.match(readFailureMessage({ name: "AI_APICallError", message: "API key not valid. Please pass a valid API key." }), /didn't accept this site's key/);
  assert.match(readFailureMessage({ name: "TimeoutError", message: "" }), /took too long/);
  assert.match(readFailureMessage({ name: "AbortError", message: "" }), /took too long/);
  assert.match(readFailureMessage({ name: "AI_NoObjectGeneratedError", message: "could not parse" }), /couldn't be read/);
  assert.match(readFailureMessage(null), /couldn't be read/);
});
