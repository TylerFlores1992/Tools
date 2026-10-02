# Lessons carried over from CampHawk

Read from `TylerFlores1992/campsite-finder` on 2026-10-02 (read-only). Principles, not brand:
nothing here copies CampHawk's colours, type or look.

## Documentation
- **CLAUDE.md is a router.** It's injected into every turn. CampHawk's reached 20,414 lines
  (~400k tokens, ~52% of a session's bill), was pruned to 1,309 on 2026-09-21, and was back to
  3,203 by 2026-10-02. Here a test caps it at 120 lines (`scripts/docs.test.mts`).
- **`@imports` are inlined** and save nothing. Only a skill body is fetched on demand, and only
  when its `description` matches — so descriptions are written as **triggers** (paths, symptoms).
- **A router entry carries the conclusion**, so a reader who never opens the detail still can't
  re-run a dead experiment.
- **Move, never delete.** History goes to docs/ with a pointer.
- **Vendored skills are pinned by hash**; instructions are never fetched at run time.

## Design system
- **Colour = meaning**, defined once in CSS, one palette.
- **A class naming a token that doesn't exist renders nothing** in Tailwind v4 and passes tsc,
  lint and build. CampHawk shipped seven. Here `src/design/tokens.test.mts` asks Tailwind's own
  compiler whether every class generates CSS, and the stock palette is deleted outright.
- **Contrast is a test.** CampHawk's most-used grey was 3.22:1. Here every allowed pair is
  checked in both themes (`src/design/contrast.test.mts`).
- **Luminance, not just hue, for states that must differ.** A selected pin and an open pin
  differed 1.02:1 in luminance — identical to a deuteranope. Here distinct states are checked
  under simulated deuteranopia and protanopia.
- **Fonts named must be loaded; fonts loaded must be used** (`src/design/fonts.test.mts`).
- **Primitives before pages**; extend a primitive instead of copying class strings.
- **Dark mode needs explicit form-control tokens** and `color-scheme` — CampHawk dropped dark
  mode because inputs inherited near-white text.

## Accessibility (from CampHawk's audit, 2026-09-26)
- Never colour alone (icon + word). AA contrast minimum. Visible focus, never a 1px hue change.
- 44px touch targets; real radio semantics for single-choice chips; skip link +
  `scroll-padding-top` under sticky headers; busy buttons keep their accessible name; Escape
  returns focus; state changes are announced; every animation has a reduced-motion path.

## Next.js
- `headers()`/`cookies()` in the root layout 500'd every CampHawk page in production while
  `next build` passed (2026-07-24). Smoke-test real pages after deploying.
- `robots` per page, not in the layout.
- Training-data Next is stale: read `node_modules/next/dist/docs/` first.

## Verification
- One `npm run verify` before every push. (CampHawk's lacked lint; this one has it.)
- **Never read an exit code through a pipe** — `| tail` reports tail's status and hides
  `not ok` lines: two false greens from one command.
- `git checkout -- <file>` destroyed uncommitted work seven times. Commit before mutating.
- **The house failure shapes**: an absent reading treated as a negative; a fix present but
  inert; a guard anchored on the wrong thing (mutation-test it, and assert the mutation
  applied); presence mistaken for liveness; a tidy story recorded as fact; two facts of
  different ages presented as one.

## Copy
Plain, honest, specific. No invented metrics or testimonials. Numbers derived from data.
Unknown is never a negative. Never show users internals.
