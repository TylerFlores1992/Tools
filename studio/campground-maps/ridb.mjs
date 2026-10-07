// Reading the RIDB full export (CSV). Shared by build.mjs and sample.mjs.
import { readFileSync } from "node:fs";

/** RFC 4180 CSV (quoted fields, doubled quotes, newlines inside quotes), streamed by row. */
export function* csvRows(path) {
  const s = readFileSync(path, "utf8").replace(/^﻿/, "");
  let row = [], field = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = ""; yield row; row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); yield row; }
}
export function* csvObjects(path) {
  let head;
  for (const r of csvRows(path)) {
    if (!head) { head = r; continue; }
    if (r.length === 1 && r[0] === "") continue;
    yield Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""]));
  }
}

