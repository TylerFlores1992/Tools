@AGENTS.md

# tylerflores.dev — router

**What it is:** Cyber Wolf's workshop — small tools for riggers, campers and the curious.
Next.js 16 (App Router, static), TypeScript, Tailwind v4 (tokens in CSS), Vercel. Dark-first.
The owner is red-green colour-blind: **never signal anything with colour alone.**

This file is loaded into every turn. **Keep it a router**: one line of conclusion + where the
detail lives. `scripts/docs.test.mts` fails above 120 lines. Detail → a skill; history → docs/.

## Commands
- `npm run dev` · `npm run build` · `npm start`
- `npm run verify` — typecheck + lint + tests + build. **Run before every push.**
- `npm run shots [-- /route …]` — screenshots at 375/768/1440/2560 × light/dark into
  `screenshots/` (gitignored). **Look at them before saying anything looks good.**
- `npm run e2e` — browser checks of real behaviour (deep links, keyboard, unit switch, errors).
- `npm run smoke -- https://<deploy>` — checks real pages answer 200 after a deploy.

## Where the detail lives
| Topic | Go to |
|---|---|
| How it should look, tokens, type, motion, copy | skill `flores-design` |
| New look, redesign, mockups, "make it high-end" (process + taste) | skill `design-direction` |
| Accessibility / UI review before merge | skill `ui-audit` |
| The hero film (terrain, wolf, encode) | skill `hero-film` · `studio/film/` |
| Campground site maps: "complete the maps" (plan, rules, loop) | skill `campground-maps` · `docs/design/campground-maps-playbook.md` |
| The approved brief, sitemap, design spec | `docs/BRIEF.md` |
| Lessons carried over from CampHawk, and why | `docs/CAMPHAWK-LESSONS.md` |
| Vercel, domain, CI setup | `docs/SETUP.md` |
| Where the last session stopped | `docs/NEXT-SESSION.md` |

## Standing rules (conclusions; the why is in docs/CAMPHAWK-LESSONS.md)
- **Read `node_modules/next/dist/docs/` before writing Next code.** Training-data Next is stale.
- **Never call `headers()`/`cookies()`/`connection()` in the root layout** — it 500s every page
  at request time while `next build` passes. Theme is applied by the inline script instead.
- **`robots` and page metadata are per page**, never in a layout.
- **`next build` passing doesn't prove a page renders.** Smoke-test real URLs after deploy.
- **Tokens only.** No hex in components, no stock Tailwind colours (deleted; they render
  nothing). A class that generates no CSS fails `src/design/tokens.test.mts`.
- **New colour pair → add it to `src/design/tokens.ts` first.** Contrast is a test, not a hope.
- **Counts and facts come from data** (`src/lib/tools.ts`, `src/lib/site.ts`), never typed.
- **Never read an exit code through a pipe.** `cmd > log 2>&1; echo $?`, then read the log.
- **Commit before experimenting**; revert by edit, never `git checkout -- <file>`.
- **Mutation-test every new guard**: break the thing, see the test fail, confirm the break applied.
- **Branch → PR → merge.** Never push to `main`. Small commits.
- **US spelling** in user-visible copy (`src/lib/us-spelling.test.mts`). Comments: any.
- **No bio / about-me / nickname content** on the site (owner's call, 2026-10-02).

## Layout
- `src/app/` routes · `src/components/` primitives (Phase 4) · `src/design/` tokens + tests
- `src/lib/` site facts, tool list · `src/fonts/` OFL woff2, subset (`scripts/subset-fonts.sh`)
- `src/tools/<slug>/` each tool's maths (tested) + UI · `src/og/` share-image assets
- `scripts/` screenshot, smoke, doc guards · `studio/film/` hero film source
- `src/app/private/` the Private tab: password-only sign-in, `src/proxy.ts` guards `/private/*`
  (`LAB_PASSWORD`, `src/lib/private-auth.ts`; docs/SETUP.md) · projects listed in `src/lib/private.ts`
- `src/lab/camphawk/` + `src/app/private/camphawk/` CampHawk design lab: mockups only, never
  camphawk.app (`ch-*` tokens, lab only). Chosen look "Golden hour": every CampHawk screen under
  `/private/camphawk/golden-hour` (map at `/screens`; `round2/` core five, `round2/pages/` the
  rest, framed by `LabPage`/`BareFrame`; switches in the URL via `labState.ts`, gates and routes
  in `gates.ts`; CampHawk's controls in `lab/camphawk/ui/`). CampHawk's own design skill binds them; art from
  `studio/camphawk-round2/` (AI Gateway, free credit only)
- Campground site maps (lab): drawn from public data, `studio/campground-maps/` → `round2/maps/`;
  roads from the source the sites fit (`roads.mjs`), plus what a person traced from the photo
  (`studio/campground-maps/traces/`, downloaded from the review page's tracing tool);
  plan, research and the 50-campground Rec.gov sample in `docs/design/campground-maps.md`; its
  review queue (admin mock) is `/private/camphawk/golden-hour/admin/site-maps` (`round2/admin/`). **State Parks' campsite
  data is local-only (`public/lab-local/`, git-ignored) until they approve: never commit it**
- `public/media/hero/<hash>/` rendered film + posters, cached immutable (`src/lib/hero-media.ts`)

## End of every session
Update `docs/NEXT-SESSION.md` (what's done, what's next, what's blocked) and this router if a
pointer changed.
