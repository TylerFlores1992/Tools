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

const CHECKS: { path: string; status: number; contains: string; absent?: string }[] = [
  { path: "/", status: 200, contains: "Sharp teeth." },
  { path: "/workshop", status: 200, contains: "Tools" },
  { path: "/workshop/bridle-calculator", status: 200, contains: "Two-leg bridle" },
  { path: "/workshop/etcp-rigger-study", status: 200, contains: "ETCP rigger study" },
  { path: "/workshop/etcp-rigger-study/practice/a", status: 200, contains: "Practice test A" },
  { path: "/workshop/etcp-rigger-study/practice/c", status: 200, contains: "Practice test C" },
  { path: "/workshop/etcp-rigger-study/flashcards", status: 200, contains: "Flashcards" },
  { path: "/workshop/etcp-rigger-study/formulas", status: 200, contains: "Formula reference" },
  { path: "/does-not-exist", status: 404, contains: "Lost the trail." },
  // The private area must stay private. Pages land on the sign-in page (fetch follows the
  // redirect); files are refused outright.
  { path: "/private", status: 200, contains: "Enter the password", absent: "Sign out" },
  { path: "/private/camphawk", status: 200, contains: "Enter the password", absent: "already booked" },
  { path: "/lab/camphawk", status: 200, contains: "Enter the password", absent: "already booked" },
  { path: "/private/camphawk/hero-bg.webp", status: 401, contains: "This area is private." },
];

let failed = 0;
for (const c of CHECKS) {
  const res = await fetch(base + c.path, { headers: { "sec-fetch-dest": "document", accept: "text/html" } });
  const body = await res.text();
  const ok = res.status === c.status && body.includes(c.contains) && !(c.absent && body.includes(c.absent));
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.path} → ${res.status}${ok ? "" : ` (expected ${c.status} containing "${c.contains}"${c.absent ? ` and not "${c.absent}"` : ""})`}`);
}
process.exit(failed ? 1 : 0);
