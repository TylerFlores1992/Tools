/**
 * The installed app's icon and launch intro (2026-10-22). Guards the three things that made the
 * old one look cheap or that would make the new one a nuisance.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import manifestModule from "../app/manifest.ts";

// tsx hands a .ts default export to an .mts file wrapped once more.
const mod = manifestModule as unknown as typeof manifestModule | { default: typeof manifestModule };
const manifest = typeof mod === "function" ? mod : mod.default;

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the manifest offers full-bleed PNG icons Android may mask, and every file exists", () => {
  const icons = manifest().icons ?? [];
  assert.ok(icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512"), "a 512 maskable icon");
  assert.ok(!icons.some((i) => i.type === "image/svg+xml"), "no SVG: Android shrinks it onto a white circle");
  for (const i of icons) assert.ok(existsSync(new URL(`../../public${i.src}`, import.meta.url)), `${i.src} exists`);
});

test("the intro starts from Android's launch screen colour, in both themes", () => {
  assert.equal(manifest().background_color, css.match(/--launch-night:\s*(#[0-9a-f]{6})/i)?.[1]);
});

test("the intro runs only for the installed app, once per launch, never with reduced motion", () => {
  const script = layout.match(/const LAUNCH_SCRIPT = `([^`]+)`/)?.[1] ?? "";
  assert.ok(script, "LAUNCH_SCRIPT found");
  assert.match(script, /display-mode: standalone/);
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /sessionStorage/);
  assert.match(layout, /__html: LAUNCH_SCRIPT/, "and it is actually rendered");
  // The CSS hides it with reduced motion too, in case the setting changes mid-launch.
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*html\[data-launch\] \.launch \{ display: none; \}/);
  // It never blocks a tap.
  assert.match(css, /html\[data-launch\] \.launch \{[^}]*pointer-events: none/);
});
