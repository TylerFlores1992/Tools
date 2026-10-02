/**
 * Post-deploy smoke test: real pages must answer with real content.
 *   npm run smoke -- https://tylerflores.dev
 * `next build` passing doesn't prove a page renders (CampHawk's root layout 500'd every page
 * in production while the build was green).
 */
const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("usage: npm run smoke -- https://<deployment>");
  process.exit(2);
}

const CHECKS: { path: string; status: number; contains: string }[] = [
  { path: "/", status: 200, contains: "Sharp teeth." },
  { path: "/workshop", status: 200, contains: "Tools" },
  { path: "/does-not-exist", status: 404, contains: "Lost the trail." },
];

let failed = 0;
for (const c of CHECKS) {
  const res = await fetch(base + c.path, { headers: { "sec-fetch-dest": "document", accept: "text/html" } });
  const body = await res.text();
  const ok = res.status === c.status && body.includes(c.contains);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.path} → ${res.status}${ok ? "" : ` (expected ${c.status} containing "${c.contains}")`}`);
}
process.exit(failed ? 1 : 0);
