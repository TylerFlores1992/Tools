// Builds Rig Studio into one HTML file for the Artifact tool: React, three and the rig modules
// bundled and inlined, fonts from Google Fonts. `npx tsx studio/rig-studio/build.mts`.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist");
mkdirSync(out, { recursive: true });

const r = await build({
  entryPoints: [join(here, "src/app.tsx")],
  bundle: true,
  minify: !process.env.RS_DEV, // RS_DEV=1: readable React errors with component stacks (debugging only)
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  write: false,
  legalComments: "none",
  define: { "process.env.NODE_ENV": process.env.RS_DEV ? '"development"' : '"production"' },
  logLevel: "warning",
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(here, "src/styles.css"), "utf8");

const html = `<title>Rig Studio</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Mona+Sans:wdth,wght@75..125,300..800&display=swap">
<style>${css}</style>
<div id="app"><div class="boot">Opening Rig Studio…</div></div>
<script>${js}</script>
`;
writeFileSync(join(out, "rig-studio.html"), html);
console.log(`wrote ${join(out, "rig-studio.html")} (${Math.round(html.length / 1024)} KB)`);
