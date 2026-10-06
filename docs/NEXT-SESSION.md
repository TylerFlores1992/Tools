# Next session

*Updated at the end of every session. Read this first, then `CLAUDE.md`.*
*Last updated: 2026-10-06 (Golden hour finished; campground page added).*

## At a glance

| What | Where | State |
|---|---|---|
| Site | https://tylerflores.dev | Live. Merges to `main` deploy production automatically. |
| Home hero | `/` | Live. Signed off by the owner. |
| Bridle calculator | `/workshop/bridle-calculator` | Live. Signed off by the owner. |
| ETCP rigger study | `/workshop/etcp-rigger-study` | Live. Practice tests A/B, 73 flashcards, formula reference. |
| Private tab | `/private` | Live. Password-only sign-in in the site's design; 30-day session. Lists private projects. |
| CampHawk lab | `/private/camphawk` | Live, behind Private. Mockups only: nothing here changes camphawk.app. (`/lab/camphawk` redirects here.) |
| ↳ **Golden hour (chosen look)** | `/private/camphawk/golden-hour` | Live. The home page in the look the owner picked. Critic 7/10, every finding since fixed. |
| ↳ **Campground page** | `/private/camphawk/golden-hour/campground` | Live. CampHawk's campground page in the same look, with every real state. Critic 7/10, findings fixed. |
| ↳ Trail poster | `/private/camphawk/trail-poster` | Live. The other round-2 direction, kept for reference only. |
| ↳ Round 1 looks | `/private/camphawk/looks` | Live. Six backdrop-only mockups (critic 4/10). Superseded; kept for history. |
| Hosting | Vercel project `tylerflores-dev` (Hobby, $0) | Details in `docs/SETUP.md`. |
| Domain + DNS | Cloudflare | Done. HTTPS certificates issued and auto-renewed by Vercel. |

**How to see the lab:** open https://tylerflores.dev/private and sign in with the Private
password (`LAB_PASSWORD`). Vercel preview links for a branch can't sign in: `LAB_PASSWORD` is set
for Production only, and the sign-in fails closed without it. To review a branch before merging,
add `LAB_PASSWORD` to Vercel's Preview environment (Settings → Environment Variables) and redeploy.

**Checks, all green:** `npm run verify` (111 tests) · `npm run e2e` (25 browser checks) ·
`npm run shots` (80 screenshots) · `npm run smoke -- https://tylerflores.dev` (15 checks, including
that `/private`, every lab page and its old URL land on the sign-in page and private files answer 401).

## Waiting on the owner
1. **GitHub default branch → `main`** (GitHub → Settings → General → Default branch). New PRs
   still default to the old session branch.
2. *(Optional)* **`LAB_PASSWORD` for Preview** in Vercel, so lab work can be reviewed on a
   branch's preview link before it merges.

## Next up (in order)
1. **CampHawk lab: the owner reviews Golden hour** (home and campground), then the next screen
   in the same look. Candidates, by how often campers see them: Explore (`/search`, map and
   filters), New watch (`/new`), Watches (`/watches`). Port from CampHawk read-only (below).
   Known gaps, small: the returning subscriber's "Resubscribe to watch" label isn't in the
   lab's "View as"; the campsite photo (c2) is very dark; Trail poster (B) wasn't reworked to
   CampHawk's colour rules, since it's reference only.
   **CampHawk's code:** attach `TylerFlores1992/campsite-finder` to the session **read-only**
   (`add_repo`, access "read"), clone to `/home/user/campsite-finder`, then disable pushing:
   `git -C /home/user/campsite-finder remote set-url --push origin DISABLED-read-only`. Never
   modify it. Its design rules (`.claude/skills/camphawk-design/SKILL.md`) bind every lab
   screen and win over references (that's why there's no glass).
2. **Speed:** measure LCP with https://pagespeed.web.dev on tylerflores.dev. Target is 1.8 s on
   mobile. If over, trim client JS (home ships only HeroFilm as a client component; check the
   bundle with `next experimental-analyze`).
3. **Hero media caching:** files in `public/media/hero/` are served `max-age=0`. Version the
   filenames and send `immutable` caching from `next.config` headers.
4. **CI:** add `npm run e2e` (needs a Chromium install step on the runner).
5. **Later:** ⌘K palette, `/bench`, offline support for `/workshop/*`, a CampHawk tier-3 page
   with real screenshots (ask before publishing any number).

## What's built, in more detail

### Foundations (Phases 0–3)
Brief: `docs/BRIEF.md` (Direction E "Monument"). Next 16 + Tailwind 4 tokens, design guard
tests, screenshot harness, CI, skills. Primitives in `src/components/`. Fonts subset to 40 KB
(`scripts/subset-fonts.sh`). Per-page OG images, sitemap, robots, manifest, view transitions.

### Home hero
Code-rendered film (`studio/film/`, skill `hero-film`): 16:9 and portrait cuts, AV1/H.264,
AVIF posters. Intro readable in about 1.2 s. Reduced motion or Save-Data shows the poster only.

### Bridle calculator
Math in `src/tools/bridle/math.ts`, tested against worked examples and 500 random rigs.
Draggable and keyboard-operable diagram, ft/lb ↔ m/kg, deep links, the math worked by hand.

### ETCP rigger study (`src/tools/etcp/`)
- Practice tests A and B (25 questions each): answers lock in, ✓/✕ shown in words, working
  shown. Every numeric answer is recomputed in `questions.test.mts` (bridles through the
  calculator's solver).
- 73 flashcards in four decks, told apart by name and glyph, never colour. The original
  tilting card was backward (the higher pick gains load); fixed, with a geometry test.
- Formula reference in our own notation, each formula linked to its questions, plus the
  official ETCP PDF. Exam outline counts checked against ETCP's pages.
- Progress is saved in the browser only (`stored.ts`).

### Private tab (`src/app/private/`, `src/proxy.ts`, `src/lib/private-auth.ts`)
- The header's third tab, with a lock icon. On phones the Home tab steps aside (the "Cyber Wolf"
  name links home) so the brand never wraps; Home returns from 640 px.
- `/private/sign-in`: the site's own password page. One field, Show/Hide, errors in words with
  ✕, refocus after a miss, works without JavaScript (Server Action). A wrong password waits
  600 ms before answering.
- Session: `v1.<expiry>.<HMAC>` cookie keyed from `LAB_PASSWORD`, HttpOnly, Secure, SameSite=Lax,
  path `/private`, 30 days. Stateless; changing the password signs every device out.
- `src/proxy.ts`: pages without a session → sign-in with `?next=` (only paths inside `/private`
  are honored); files → 401; everything private gets noindex + `Cache-Control: private,
  no-store`. Fails closed when the variable is unset or empty.
- `/private`: lists projects from `src/lib/private.ts`, plus Sign out.

### CampHawk lab (`src/lab/camphawk/`, `src/app/private/camphawk/`)
- CampHawk's marketing home ported as a design sandbox, with a "View as" switch for its
  signed-out / subscriber / in-app pricing. Fake data; every link is `#`. A breadcrumb leads
  back to Private.
- CampHawk's look is scoped to the lab: `ch-*` tokens in `globals.css`, Bitter + Nunito Sans
  loaded in the lab layout only, brand images in `public/private/camphawk/`.
- **New looks** (`src/lab/camphawk/looks.ts`, `LookScene.tsx`, `/private/camphawk/looks`):
  Ridgeline, Topo, Field guide, Park poster, Dusk, Painted, plus Current. `?look=<id>` picks one;
  the switch keeps it in the URL. Each look changes only the backdrop and the card finish
  (`.look[data-look=…]` rules in `globals.css`). Ridgeline and Dusk bend CampHawk's "no gradients
  or glows" rule; the overview says so.
- Look art is drawn in code from CampHawk's palette: `node studio/camphawk-looks/render.mjs
  [name …]` writes `public/private/camphawk/looks/*.webp` (seeded, so renders repeat exactly).
  Painted is CampHawk's own unused `hero-bg-alt.webp`. Dusk's hero type is light on `ch-ink`
  (7.2:1 or better; those pairs aren't in the contrast test, which covers our tokens only).
- Not ported yet: CampHawk's `--ch-sticky` scroll padding (anchor jumps can land under the
  phone header) and the account menu.

### CampHawk round 2 (`src/lab/camphawk/round2/`)
- Built with skill `design-direction`. Brief, references, contracts and "As built" notes for both
  screens: `docs/design/camphawk-home.md`.
- **Golden hour home** (`GoldenHour.tsx`): a dusk photo hero (one photo at every size), an
  example alert as CampHawk's open-site card, search docked on the photo's edge (under the intro
  on phones). "What a watch does" shows each promise as a piece of CampHawk's UI
  (`WatchProofs.tsx`). Pricing in `Pricing2.tsx`.
- **Campground** (`Campground.tsx`, `campground-data.ts`): the answer first ("5 days with
  openings in July"), docked photos, a month calendar with CampHawk's states (open, booked, past,
  couldn't check, not open for booking, failed read), the day panel, About, "Is … fully booked?".
  Lab switches: "View as" (four visitors, each with WatchCta's label), "Reservations / First
  come", "Page" (loaded, loading, not found, couldn't load) and "From" (search or Google, which
  swaps "Back to search" for the breadcrumb). Example data pins "today" to Jul 6, 2026.
- **CampHawk's rules hold everywhere:** green only for an open site or an action, blue for the
  Recreation.gov hand-off, ochre only for "you asked for this", every status in words (`Tag`,
  `Card` ported to `src/lab/camphawk/ui/`), "Open for Jul 18-21" dates, `shadow-ch-pop` only, no
  glass. Shared chrome in `GhChrome.tsx`; the lab bar in `LabBar.tsx`; home copy in `copy.ts`.
- **Art** is generated: `studio/camphawk-round2/` (`generate.mjs` through Vercel AI Gateway,
  `prompts.mjs`, `export.mjs` for picks). Free credit only: $2.34 of $5 used, nothing bought;
  GPT Image and the Recraft pro tiers refuse free credit (403). Flux ignores "no X": describe
  what IS in the frame instead.
- **Guards:** e2e checks both directions' art, search and pricing views, the copy rewrites, and
  the campground's days, months, page states, breadcrumb and watch labels (each new guard
  mutation-tested). The lab's scrollbar, overscroll ground, selection and phone browser bar are
  themed (`html:has(.camphawk)` in globals.css).
- Save the owner's reference screenshots to `docs/design/refs/` next round.

## Measurements (2026-10-02)
- Local production build, Lighthouse 12, mobile: home 98, calculator 98, workshop 99
  performance; 100 accessibility, best practices and SEO; CLS 0. LCP 2.2–2.4 s simulated
  (target 1.8 s). Desktop: 100, LCP 0.5–0.6 s.
- Lighthouse run from this container against the live site is too noisy to judge (LCP 1.9 to
  3.6 s across runs). Use PageSpeed Insights from a real browser.

## Gotchas
- `globals.css` collapses every transition to 1ms under reduced motion, and the default
  transition property is `all`: a script that reads computed styles (an outline, a colour) right
  after a change sees the old value. Wait a frame (30-60ms) before reading or screenshotting.
- A `<label>` that wraps a `<select>` makes the option text part of its accessible name; give the
  select an `aria-label` if tests look it up by label.
- `hidden` plus `buttonClasses()` on one element: the button's `inline-flex` wins and it shows.
  Wrap it in `<span className="hidden sm:contents">` instead.
- A grid with a fixed container height still sizes its implicit rows to content (square photos
  overflow and cover what's below). Set `auto-rows-[…]` on the grid, not `h-[…]`.
- Lab headings: `.camphawk h1` uses `var(--font-ch-display)`, which `@theme inline` never emits, so
  headings on the lab's Current page render in Nunito. Round 2 names Bitter directly. Check whether
  camphawk.app has the same bug before "fixing" Current.
- AI Gateway's OpenAI-style `/v1/images/generations` ignores `aspect_ratio`; use the AI SDK's
  `generateImage({ aspectRatio })` (studio/camphawk-round2/ has its own package.json).
- Recraft (free tier) tops out at 1280px; flat poster art survives a 2x Lanczos upscale, photos wouldn't.
- `create-next-app` refuses the folder name "Tools" (capitals): scaffold elsewhere, copy in.
- `LayoutProps` needs `next typegen` before `tsc` on a clean checkout (`typecheck` does it).
- `pkill -f 'next start'` kills your own shell. Use `pkill -f '[n]ext-server'`.
- Software WebGL here renders about 5 s per 1080p film frame; run film renders in the background.
- tsx injects `__name()` into functions passed to `page.evaluate`: add
  `page.addInitScript("globalThis.__name = (f) => f")` first (scripts do).
- Screenshot after entrance animations finish, or the shot (and contrast reading) lies.
- `opacity-*` on text breaks token contrast; the opacity guard fails on it.
- A mutation test only counts if the build succeeds: a break that fails `tsc` leaves the old
  build in place and the e2e run proves nothing. Check `npm run build` exits 0 first.
- In a `&&` chain, don't put `;` before `git push`: the push runs even when an earlier commit
  failed.
- Vercel connector: pass no `teamId` (403 "re-authenticate to this scope"); `create_project`
  works where `create_git_project` doesn't. It can't sign in to Private: test that with
  `npm run e2e` locally, which starts its own server with a known password.
- Next's route announcer repeats the new page's `<h1>` in a hidden live region after a client
  navigation, so `getByText(<h1 text>)` matches twice. Use `getByRole("heading", …)`.
- A plain CSS class used only inside a compound selector (`.look[data-look=x]`) fails the tokens
  test: give it a base rule of its own at the start of a line.
- Playwright `fullPage` shots draw `position: fixed` backgrounds one viewport tall (the Topo map
  stops partway). That's the screenshot, not the page; check by scrolling.
- Text fields draw the focus ring on their frame: wrap the input in `.field` (globals.css).
- From this container, `curl https://tylerflores.dev` fails but Node's `fetch` works, so
  `npm run smoke -- https://tylerflores.dev` is fine. To inspect the certificate:
  `openssl s_client -connect tylerflores.dev:443 -servername tylerflores.dev -proxy ${HTTPS_PROXY#http://}`.
- Lighthouse against a live URL from here needs `--chrome-flags="--ignore-certificate-errors
  --proxy-server=$HTTPS_PROXY"` (the proxy re-signs TLS).
