import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONNECTOR } from "./connector.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");

test("the page offers the connector version that's in the repo", () => {
  const pyproject = readFileSync(join(ROOT, "connectors/vectorworks/pyproject.toml"), "utf8");
  assert.equal(pyproject.match(/^version = "([^"]+)"/m)?.[1], CONNECTOR.version);
  const init = readFileSync(join(ROOT, "connectors/vectorworks/src/vwmcp/__init__.py"), "utf8");
  assert.match(init, new RegExp(`__version__ = "${CONNECTOR.version.replace(/\./g, "\\.")}"`));
});

test("the download exists, behind the Private sign-in", () => {
  assert.ok(CONNECTOR.download.startsWith("/private/"), "served only to signed-in visitors (src/proxy.ts)");
  assert.ok(existsSync(join(ROOT, "public", CONNECTOR.download)), "run: python connectors/vectorworks/make_zip.py");
});
