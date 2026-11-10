import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONNECTOR } from "./connector.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");

test("the page offers the connector version that's in the repo", () => {
  // pyproject.toml's version is held at 0.5.6 through 0.5.9 (make_zip.py says why); __init__ is the truth.
  const init = readFileSync(join(ROOT, "connectors/vectorworks/src/vwmcp/__init__.py"), "utf8");
  assert.match(init, new RegExp(`__version__ = "${CONNECTOR.version.replace(/\./g, "\\.")}"`));
});

test("the download exists, behind the Private sign-in", () => {
  assert.ok(CONNECTOR.download.startsWith("/private/"), "served only to signed-in visitors (src/proxy.ts)");
  assert.ok(existsSync(join(ROOT, "public", CONNECTOR.download)), "run: python connectors/vectorworks/make_zip.py");
});

test("the update manifest matches the zip and the version, and the site's symbol map is the connector's", async () => {
  const { createHash } = await import("node:crypto");
  const dir = join(ROOT, "public/private/vectorworks");
  const manifest = JSON.parse(readFileSync(join(dir, "vwmcp-win.json"), "utf8"));
  const zip = readFileSync(join(dir, "vwmcp-win.zip"));
  const why = "run: python connectors/vectorworks/make_zip.py (connectors update themselves from these files)";
  assert.equal(manifest.version, CONNECTOR.version, why);
  assert.equal(manifest.sha256, createHash("sha256").update(zip).digest("hex"), why);
  assert.equal(manifest.size, zip.length, why);
  assert.equal(readFileSync(join(dir, "symbols.json"), "utf8"), readFileSync(join(ROOT, "connectors/vectorworks/src/vwmcp/symbols.json"), "utf8"), why);
});
