/** The résumé download label shows the file's real size, and nothing when it can't be read. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFileSize, publicFileSize } from "./resume-file.ts";

test("sizes read as KB under a megabyte, MB above", () => {
  assert.equal(formatFileSize(102_109), "100 KB");
  assert.equal(formatFileSize(300), "1 KB");
  assert.equal(formatFileSize(1_258_291), "1.2 MB");
});

test("a missing file gives no size rather than a made-up one", () => {
  assert.equal(publicFileSize("/no/such/file.pdf"), null);
});
