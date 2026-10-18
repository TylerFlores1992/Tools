# Home hero: "wilderness cyber" redesign (brief, references, image sources)

*Started 2026-10-18. Owner: "a slight redesign of our dev page. I like the idea. Wilderness cyber
tech feel. But our wolf drawing and woods background you created are not great." Process: skill
`design-direction`. Gates 1 (brief) and 2 (references) are done here. Gate 3's written directions are in §3;
its drafts are next. Nothing is built yet.*

## Pick up here (next session)
1. Cloudflare works. The token verifies, but it can't list accounts, so pass the account ID
   (from the owner's dashboard URL, not a secret): `CLOUDFLARE_ACCOUNT_ID=942122fe5e7400a73c200ada08e544fb`.
2. References: the owner re-attached all three on 2026-10-18; they match §2. They live in
   `studio/hero-wilderness/ref/` (git-ignored, gone when the container is). Never commit them: two
   are watermarked stock and one is someone's painting. A new container needs them attached again.
3. Gate 3 drafts done 2026-10-18: 16 per direction (12 wide, 4 tall) on FLUX.2 klein 4B, about
   5,000 neurons estimated, all free. Shown to the owner as two sheets beside the references
   (session only; regenerate the sheets from `out/`).
   **Owner's pick (2026-10-18): "A12 setting with a B1 realistic vibe."** That's direction C in
   `prompts.mjs`: 12 wide + 6 tall drafted (~2,800 neurons). Strongest: c-wide 01, 05, 09 (path,
   wolf right, circuits in the fur) and 03, 07, 11 (wolf at a wired trunk); tall 01, 05.
   Owner picked **C09 wide + C05 tall** for the finals.
4. **Finals made 2026-10-18** (`studio/hero-wilderness/final.mjs`, Flux 1.1 Ultra on the Vercel
   credit, the picked draft passed in as BFL's image prompt): **`wide-ultra-03`** (2752 x 1536) and
   **`tall-ultra-05`** (1536 x 2752), in `out/finals/` (git-ignored; copy them into `public/` at
   build time). 10 images, $0.60; **$0.825 left**. Lessons:
   - Ultra overdoes "luminous" / "glowing wiring" (thick neon lines, a glowing road). The finals use
     `FINAL_C`, the same scene asking for hairline-thin, faint traces and a muted grade.
   - Image-prompt strength 0.5 loses the draft's restraint; 0.85 (wide) and 0.95 (tall) keep it.
   - Every tall cut floats a few circuit fragments in the air. tall-ultra-05 has one, at the left
     middle: retouch it (or a $0.04 Kontext edit) before it ships, and record that as an edit.
   **Owner, 2026-10-18: dislikes both finals and the C blend.** "The original art and original
   detailed I chose to merge both look the best before the merge." So the candidates are the
   drafts themselves, **a-wide-klein-12** and **b-wide-klein-01**, used as-is at 1536 px (owner's
   call; no upscale). Both were mocked into the real home page beside the current film (session
   only). Lesson: re-running a picked draft on a "better" model lost what made it good; when the
   owner picks a draft, ship that draft. **Owner chose B1**, then "a free enhanced version": Real-ESRGAN x4plus (BSD-3, run locally on
   CPU), brought back to 3072 x 1728; the owner picked it over the x2 model.
5. **Built 2026-10-18** (§5): `src/components/HeroArt.tsx` replaces the film (no client JS); cuts
   from `studio/hero-wilderness/encode.mjs` in `public/media/hero/<hash>/` (wide 960/1600/2560,
   portrait 720/1080, AVIF + WebP; 1600 AVIF 54 KB). The film's source
   (`studio/film/`) and skill `hero-film` are retired; git history keeps them.
6. **Gate 6, critic round 1: 6/10, "fix then ship".** Fixed in one batch:
   - **Face under the type on tablet/phone** → portrait art fills the top 72% and fades to night.
   - **Full-width bottom scrim muddied the wolf and left ember specks by "teeth."** → a left
     scrim under the type, plus a short floor into the footer.
   - **The 36 s zoom softened the upscale**, and over 5 s it needs a pause control (WCAG 2.2.2,
     from the UI audit) → dropped; only the 2.4 s settle remains.
   - **Not taken, outside the brief:** B's parallax and rising sparks (more motion would need a
     pause control); a solid nav pill and the footer's gutter (shared site chrome).
   **Round 2: 7/10, "fix then ship"** (desktop and phone rated ship quality). Last fixes, then
   stopped at the two-round ceiling:
   - Tablets in portrait were hard-cropped (ears gone, upscale smear magnified) → the tall cut is
     now only for phone-shaped screens (`tall` variant, `max-aspect-ratio: 2/3`); tablets get the
     wide cut, whole head.
   - Stray warm specks from the art near the type → the left scrim is darker in the middle, and
     phones get a thin left-edge scrim, so the eye stays the one warm highlight.
   - Gap the critic named that's out of scope: depth against reference 1 (one subject on bokeh,
     no foreground). That's the image the owner picked.
5. Then build (§5) and critique (Gate 6).

## 1. Brief (owner-confirmed 2026-10-18)
- **Scope: the hero, plus backgrounds.** Replace the code-drawn wolf and woods with generated art.
  Keep the layout, type and tool pages as they are.
  - The only art on the public site today is the hero film: `src/components/HeroFilm.tsx`, from
    `studio/film/` (`terrain.js`, `wolf2.js`), media in `public/media/hero/<hash>/`, folder name in
    `src/lib/hero-media.ts`. Tool pages have no background art. "Backgrounds" means the hero scene,
    plus optional quiet texture elsewhere only if it earns its place.
- **Hero: a still image with subtle motion.** One strong generated image. Slow parallax or drifting
  mist done in CSS, with a reduced-motion path. **The video goes.**
- **The "cyber" side is in the art itself:** circuit or data lines and glow in the forest and in
  the wolf. That rules out the photo-only option where the tech lives only in the UI.
- **Fixed:**
  - layout, type (Mona Sans, JetBrains Mono for labels), and the colour tokens;
  - the tool pages and the copy ("Quiet tools. / Sharp teeth.", `SITE.headline`);
  - **ember is the wolf's eye**, and it's the one highlight per screen;
  - the headline stays the LCP element, never the image;
  - the home hero is always night (`.theme-night`);
  - colour never carries meaning alone (the owner is red-green colour-blind).
- **Free:** the hero art, its composition, and the motion layer.
- **Never** (from `flores-design`): cheesy cyberpunk. No Orbitron, no Matrix rain, no neon
  green/magenta glitch.

## 2. References (owner's, 2026-10-18; images not committed)
| # | What it is | What it brings | Keep / drop |
|---|---|---|---|
| 1 | A painted forest (Red Riding Hood scene). A dark wolf half-hidden on the left, a red-hooded figure lower right, apples on the ground. | A painterly digital illustration. Deep blue-teal night; light glowing up from the ground and the grass; one warm red accent (the apples); mist between the trunks; big gnarled trees framing it. | **Keep** the palette, the ground light, and a wolf you discover rather than one posing. **Drop** the figure and the story props. |
| 2 | Stock (Dreamstime, watermarked). A full-body robotic wolf with armour plating, walking through a blue night forest, with red-orange glowing seams, red eyes and sparks. | Tech built into the animal; a red eye and glowing seams; blue forest bokeh; floating sparks. | **Keep** the seams and eye as ember, and the sparks. **Drop** the full armour (too toy-like) and the watermark. **Reference only.** |
| 3 | Stock (Dreamstime, watermarked). A wolf portrait with glowing white-blue circuit lines through the fur and a magenta-pink eye, in front of city bokeh. | Circuit lines drawn through real-looking fur; a glowing eye; a close portrait. | **Keep** the circuit lines in the fur. **Drop** the city: wilderness was asked for. The eye goes ember, not magenta. **Reference only.** |

**What they share:**
- a dark blue-teal night;
- one warm or red accent, which matches the site's `ember`;
- a wolf on one side, leaving room for the headline;
- light from the details (eyes, seams, the ground), not from the sky.

**Craft bar:** reference 1's finish (painterly, with depth and atmosphere) is the level to reach.
References 2 and 3 are the idea of the tech, not the finish: both read as stock.

**Licensing:** none of the three may be used, traced or edited. Prompts describe the look and
never name the images or their makers.

**Colour-blind check:** red or ember against blue-teal stays distinct for a deuteranope. The
headline must never depend on the red.

## 3. Directions (Gate 3, written 2026-10-18)
Both keep the layout, type, tokens and copy (§1 Fixed). They differ in **what the image is**
(a scene you look into vs. an animal that looks at you) and so in where the headline sits and how
the motion works. Draft prompts: `studio/hero-wilderness/prompts.mjs`; drafting:
`studio/hero-wilderness/draft.mjs` (Cloudflare, free; output in its `out/`, gitignored).

**Shared composition:** the wolf on the right, or its head at upper right; dark, quiet space on the
left for "Quiet tools. / Sharp teeth."; a wide master (about 2560 x 1440) plus a portrait cut
composed for phones, not a crop; a separate mist or spark layer if the model gives one.

### A. "The wired wood" (painterly)
- **Thesis:** the forest is the machine. The tech isn't worn by the wolf; it grows through the
  bark and roots like veins, and the wolf is something you *find* in it. Refuses the category
  default of a hero animal posing centre-frame on a gradient.
- **World:** restrained. `bg` #05070e and `surface` #0b1222 carry the painting's shadows; `ice`
  #8fb4ff is the circuit and ground glow (the cool family, never meaning); `ink` #f3f5fa for the
  headline; `ember` #ffb27a only in the eye. Type unchanged: Mona Sans display, JetBrains Mono labels.
- **First viewport (1440):**
  ```
  ┌───────────────────────────────────────────────────────────────┐
  │ nav                                                           │
  │                                         ╱ gnarled trunk ╲     │
  │  Quiet tools.          (deep shadow,     roots ≈ glowing      │
  │  Sharp teeth.           mist drifts)     circuit veins   ●←eye│
  │  sub line                                 wolf half-hidden    │
  │  [Primary] [Secondary]           ░░ ground light ░░░░░░░░░░░  │
  └───────────────────────────────────────────────────────────────┘
  ```
  An hour later someone describes: "a painted night forest with glowing roots, and a wolf's eye
  watching from the trees."
- **Signature moment:** the mist layer drifts slowly (30–40 s) across the gap between the
  headline and the wolf, so the eye seems to come and go. Reduced motion: a still frame.
- **Assets:** one painted master (wide) + portrait cut, one transparent or screen-blended mist plate.
  Drafts on FLUX.2 klein 4B; final on Flux 1.1 Ultra (Vercel credit).
- **Self-check (`tells.md` Defaults):** "camping → pines and mountains" is avoided: no peaks, no
  sky, the light is from the ground. Risk: "near-black with one neon accent and glowing edges";
  held off by painterly texture, the ice glow staying faint, and ember kept to one small point.

### B. "Circuit fur" (realistic)
- **Thesis:** the animal *is* the interface. A real-looking wolf, close, with fine circuitry
  following the grain of its fur and one ember eye looking past the headline. Refuses both the
  toy-robot wolf (armour plating) and the city-neon portrait.
- **World:** restrained, cooler and sharper than A. `bg` and `surface` as the fog and bokeh;
  `ink-2` #c2c9d8 / `ice` for the fur circuitry (white-blue, thin); `ember` in the eye and a few
  sparks only. Type unchanged.
- **First viewport (1440):**
  ```
  ┌───────────────────────────────────────────────────────────────┐
  │ nav                                                           │
  │                                          ╭──── wolf head ───╮ │
  │  Quiet tools.        soft blue bokeh,    │ circuit lines in  │ │
  │  Sharp teeth.        fog                 │ fur      ● ember  │ │
  │  sub line                    · spark     ╰── shoulders ─────╯ │
  │  [Primary] [Secondary]                  ·        · spark      │
  └───────────────────────────────────────────────────────────────┘
  ```
  An hour later: "a close-up of a wolf with glowing circuits in its fur and an orange eye."
- **Signature moment:** a slow parallax (the head plate moves a few px against the fog plate on
  scroll or over 20–30 s) with 3–5 sparks rising. Reduced motion: still, no sparks.
- **Assets:** one realistic master + portrait cut, a fog/background plate, a spark sprite (CSS
  dots are fine: geometry, not a picture). Drafts on klein 4B; final on Flux 1.1 Ultra.
- **Self-check:** risk is stock-photo sameness (reference 3's look). Held off by: wilderness not
  city, the circuitry thin and following the fur rather than a pasted pattern, ember not magenta,
  and the head cropped by the frame edge rather than centred.

### How the owner chooses
10–20 drafts each, wide and tall, beside the three references (sheet in the session, not
committed). Pick a direction and the 1–3 drafts whose composition is closest; the finals re-run
those prompts on the Vercel credit.

## 4. Image sources (checked 2026-10-18)

### 4.1 Vercel AI Gateway: finals only
- **Balance:** `GET https://ai-gateway.vercel.sh/v1/credits` read **$1.425 left of $5**
  (`total_used` 3.635). It hasn't refilled since early October, and whether the $5 renews is not
  established.
- **Key:** `AI_GATEWAY_API_KEY` (in the environment). Calling pattern: `studio/camphawk-round2/generate.mjs`.
  Its `FLOOR = 2` would refuse now. A new script for this work should set its own floor, for
  example $0.25, and stop there.
- **Costs and models:**
  - Flux 1.1 Ultra cost about $0.06 an image for CampHawk, so roughly 20 images are left.
  - GPT Image and the Recraft pro tiers refuse free credit (403).
  - Recraft v4.1 is capped at 1280 px on free credit.
- **Lessons from CampHawk:**
  - Flux ignores "no X"; describe what is there instead.
  - The OpenAI-style `/v1/images/generations` ignores `aspect_ratio`; use the AI SDK's call, as
    `generate.mjs` does.

### 4.2 Cloudflare Workers AI: free drafts
- **Free allowance:** 10,000 neurons a day, resetting at 00:00 UTC, across all Workers AI use.
  Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- **Models to use, both with open licences that allow commercial use of the outputs:**
  - `@cf/black-forest-labs/flux-2-klein-4b`: Apache 2.0. 5.37 neurons per input tile and 26.05 per
    output tile (512 x 512 tiles).
  - `@cf/black-forest-labs/flux-1-schnell`: Apache 2.0. 4.80 neurons per tile and 9.60 per step.
    Lower quality, near-free.
- **Rough capacity:** about a hundred klein images a day free. That's an estimate from the price
  table, not measured; read the real cost in the dashboard after the first run.
- **Avoid:**
  - `flux-2-klein-9b` and `flux-2-dev`: FLUX non-commercial licence;
  - `@cf/leonardo/*`: the terms were not checked.
- **Credentials:**
  - `CLOUDFLARE_API_TOKEN`, created by the owner 2026-10-18 from the "Workers AI" template
    (Account · Workers AI · Read and Edit; all accounts; no IP filter).
  - Verify it with `GET https://api.cloudflare.com/client/v4/user/tokens/verify`.
  - Account ID: `GET https://api.cloudflare.com/client/v4/accounts` with the token, or
    `CLOUDFLARE_ACCOUNT_ID` if the owner added it.
- **Call:** `POST https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/run/<model>`.
  - Read each model's page for its input shape before writing the script. The FLUX.2 models take
    multipart form fields and schnell takes JSON; check, don't assume.
- **Network:** the session reaches `api.cloudflare.com` through the agent proxy (checked
  2026-10-18: it answered "Missing Authorization header" without the token).

### 4.3 Ruled out
- **Gemini API free tier:** no image-generation quota as of late 2026 (third-party reports and the
  developer forum). The Gemini app by hand is possible, but it isn't scriptable.

### 4.4 Record every image's provenance (CampHawk didn't, and it's now a blocker)
For each file that ships, record in a table in this doc:
- the file;
- the model and its licence;
- the prompt;
- the date;
- the cost;
- any edit, crop or upscale.

The CampHawk lab's art has no licence or provenance note, which its hand-off had to flag as an
open owner decision.

`draft.mjs` writes every field below (model, licence, prompt, seed, size, date, cost) to
`studio/hero-wilderness/out/log.jsonl`; copy the row in when a file is picked.

| File (shipped) | Model · licence | Prompt (or `prompts.mjs` key + seed) | Date | Cost | Edits |
|---|---|---|---|---|---|
| **`public/media/hero/<hash>/hero-*.{avif,webp}`** (shipped) | `@cf/black-forest-labs/flux-2-klein-4b` on Cloudflare Workers AI · Apache 2.0 | `prompts.mjs` `b[0]`, seed 1691169373, 1536 x 864 (`b-wide-klein-01.jpg`) | 2026-10-18 | ~156 neurons (free tier) | Real-ESRGAN x4plus upscale (BSD-3, weights `RealESRGAN_x4plus.pth` sha256 `4fa0d389…`) → Lanczos to 3072 x 1728 → `encode.mjs`: wide resized; portrait cropped (9:16 from x = 42.3 %), AVIF q50 / WebP q74 |
| ~~`wide-ultra-03.jpeg`~~ (rejected by the owner) | `bfl/flux-pro-1.1-ultra` via Vercel AI Gateway, raw · BFL API terms, **output terms not yet checked** | `prompts.mjs` `FINAL_C`; image prompt `c-wide-klein-09.jpg` (FLUX.2 klein 4B, Apache 2.0, `c[0]`, seed 524737910) at strength 0.85; 16:9 | 2026-10-18 | $0.06 free credit (+ ~156 free neurons for the draft) | none yet; resize/encode at build |
| ~~`tall-ultra-05.jpeg`~~ (rejected by the owner) | same | `FINAL_C`; image prompt `c-tall-klein-05.jpg` (klein 4B, `c[0]`, seed 1051260080) at strength 0.95; 9:16 | 2026-10-18 | $0.06 free credit (+ ~156 neurons) | stray circuit fragment to retouch (left middle) |

## 5. Build notes (when the art is picked)
- **The headline stays the LCP element.** The image is a background with explicit dimensions:
  - AVIF and WebP, one wide and one portrait;
  - LQIP or a solid colour first;
  - target under about 150 KB at 1440 wide.
- **Contrast:** the headline goes over a left-side scrim. Add the pair to `src/design/tokens.ts`
  `CONTRAST_PAIRS` first; contrast is a test.
- **Motion:**
  - CSS transform and opacity only;
  - slow, about 20–40 s;
  - paused off-screen;
  - none under `prefers-reduced-motion`;
  - no layout shift.
- **Retiring the film:**
  - `HeroFilm.tsx`, `public/media/hero/<hash>/`, `src/lib/hero-media.ts` and its test,
    `next.config.ts`'s `immutable` header for that path;
  - the `hero-film` skill and `studio/film/`;
  - `scripts/smoke.mts` checks `${HERO_MEDIA}/hero-poster.webp`.

  Update or retire each deliberately. Keep `studio/film/` in history (git), not necessarily in the
  tree.
- **Before you say it looks good:** `npm run shots`. Then a fresh critic agent against the
  references (Gate 6, two rounds at most), then the owner.
