import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HERO_VERSION } from "./hero-media.ts";
import type { NextConfig } from "next";
import * as configModule from "../../next.config.ts";

// next.config.ts loads as CommonJS here, so its default export arrives wrapped once more.
const loaded = configModule.default as NextConfig | { default: NextConfig };
const nextConfig: NextConfig = "default" in loaded ? loaded.default : loaded;

const DIR = join(import.meta.dirname, "../../public/media/hero");

/** First 10 hex of a sha256 over each file's name and bytes, in name order. */
function hashOf(folder: string) {
  const h = createHash("sha256");
  for (const f of readdirSync(folder).sort()) {
    h.update(`${f}\0`);
    h.update(readFileSync(join(folder, f)));
  }
  return h.digest("hex").slice(0, 10);
}

test("the hero media sits in one folder, named for its contents", () => {
  const entries = readdirSync(DIR, { withFileTypes: true });
  assert.deepEqual(entries.filter((e) => !e.isDirectory()).map((e) => e.name), [], "files belong in the versioned folder");
  assert.deepEqual(entries.map((e) => e.name), [HERO_VERSION], "only the current version ships");
  const actual = hashOf(join(DIR, HERO_VERSION));
  assert.equal(actual, HERO_VERSION, `the files changed: rename public/media/hero/${HERO_VERSION} to ${actual} and set HERO_VERSION = "${actual}"`);
});

test("versioned hero media is sent with immutable caching", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === "/media/hero/:version/:file");
  assert.ok(rule, "next.config needs a headers() rule for /media/hero/:version/:file");
  assert.deepEqual(rule.headers, [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]);
});
