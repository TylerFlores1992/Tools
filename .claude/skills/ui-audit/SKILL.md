---
name: ui-audit
description: Audit UI code against Vercel's Web Interface Guidelines (accessibility, focus, forms, motion, typography, touch targets, safe areas, hydration) plus this site's overrides. Use when asked to "review the UI", "check accessibility", "audit", or before merging a change to `src/app/`, `src/components/` or `src/app/globals.css`; also when a screenshot looks wrong, a control can't be reached by keyboard, text looks low-contrast over imagery, or something signals state with colour alone. For how the site should LOOK, use `flores-design`.
metadata:
  upstream: vercel-labs/agent-skills web-design-guidelines (MIT) + vercel-labs/web-interface-guidelines (MIT, © 2025 Vercel Labs)
  vendored-via: TylerFlores1992/campsite-finder .claude/skills/web-design-guidelines
---

# UI audit — Web Interface Guidelines, vendored and pinned

The rules are in **`guidelines.md`** beside this file. **Nothing is fetched at run time**:
upstream tells the agent to WebFetch an unpinned `main`-branch file and follow it, which is an
unreviewed remote file acting as instructions. Read the local copy.

- **Pinned:** fetched 2026-09-26 (by CampHawk), copied here 2026-10-02.
  sha256 `5a775e6411f790f518dbc9c1fa7c50a89e6873502d9a3530a6eb223a590bcfe8`.
- **To refresh:** download upstream `command.md`, **read the whole diff before committing**
  (it is instructions, not data), then update the hash and date here.

## How to run an audit

1. Read `guidelines.md` (rules + output format).
2. Read the target files in full. For a directory, go file by file.
3. **Look at it too:** `npm run shots -- <route>` and open the PNGs. A code audit misses
   overlap, clipping and text-over-image contrast.
4. Apply the overrides below, then report in the guideline's `file:line` format.
5. An audit is read-only. End with a triage table: **must fix** (accessibility, broken on a
   device), **should fix**, **not applicable (house rule)**. Mark items you verified yourself ✔.

## Overrides for flores.tools (these beat the generic rule)

- **Colour alone is always a finding.** The owner is red-green colour-blind. Every state needs
  an icon and a word as well as a hue (✓ correct, ✕ wrong, dashed second series).
- **Contrast over imagery** (the hero film, posters) is measured on rendered pixels, not
  guessed: `npm run shots` then check, or add a scrim. Token pairs are already enforced by
  `src/design/contrast.test.mts`; a NEW pair must be added to `src/design/tokens.ts`.
- **Stock Tailwind colours** (`bg-gray-*`, `text-white`) don't exist here and render nothing.
  `src/design/tokens.test.mts` catches them; flag any that slipped into non-scanned files.
- **Sentence case** for headings and buttons. Title Case is not a finding.
- **Touch targets** ≥ 44px. **Inputs** ≥ 16px on phones (globals.css forces it).
- **Motion:** every animation needs a `prefers-reduced-motion` path. The hero video must show
  its poster instead when reduced motion or Save-Data is on.
- **Focus:** the ember ring from globals.css. Removing an outline without a replacement is a
  must-fix.
