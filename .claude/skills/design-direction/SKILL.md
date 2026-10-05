---
name: design-direction
description: The process for any new look, redesign, mockup round or "make it high-end / polished / nicer" request — on tylerflores.dev or a lab project (`src/lab/**`, `src/app/private/**`, `studio/**`). Gates: brief → references → written direction → real assets → build → fresh-eyes critique against the references. Use BEFORE writing code or drawing art for a new visual direction, when choosing imagery, or when the owner says a design looks cheap, generic, templated or "terrible". House tokens for this site stay in `flores-design`; accessibility checks in `ui-audit`.
---

# Design direction: how to make work that doesn't look generated

**Why this exists.** The first CampHawk "new look" round (2026-10-05, `src/lab/camphawk/looks.ts`)
was judged "pretty terrible" by the owner. Every failure is in `tells.md` § "Our own record". The
short version: we drew pictures in code, changed only the backdrop, never chose a point of view,
and graded our own screenshots against "is it broken?" instead of "is it as good as the best
site in this category?". This skill is the fix. Its gates are not optional.

Sources (read, not invented): Anthropic's `frontend-design` skill and its blog post on
distributional convergence; Impeccable (pbakaus/impeccable, Apache-2.0): its craft floor, its
new-work flow and its bans; Taste Skill (Leonxlnx/taste-skill, MIT): its image-first pipeline. Notes
on what each says are in `tells.md` and `critique.md`. Nothing is fetched at run time.

## The core idea
Models default to the statistical middle of the web ("distributional convergence"). Rules about
fonts don't fix that on their own. What fixes it: **a specific subject, a real reference bar, a
committed direction written down before code, real assets, and a critic who isn't the builder.**

## Gate 1: Brief (before anything visual)
Write five lines and confirm them with the owner (AskUserQuestion, two or three questions max):
1. **Subject and audience:** who, doing what, where, under what light. Light or dark comes from that
   scene, never from habit.
2. **Mode:** *Persuade* (landing/marketing: design is the product) · *Operate* (app/tool: clarity first,
   brand in the details) · *Read* (docs/guides).
3. **The page's one job** and the action that proves it worked.
4. **Fixed:** what must not change (for CampHawk: words, controls, flows, palette).
5. **Free:** what may change. "Keep the layout similar" still leaves type, scale, composition,
   imagery, rhythm and density free. Those are where "high end" lives; the backdrop is the least of it.

## Gate 2: References (the bar)
- Ask the owner for **3–6 sites they think look great** (links or screenshots in chat). Big outdoor
  and gallery sites block automated browsers from this container (Hipcamp, AllTrails, The Dyrt and
  Awwwards all failed; REI and siteinspire loaded), so screenshots from the owner are the reliable path.
- For each reference, write down specifics rather than adjectives: the headline size against body
  text, how much is in the first viewport, the image type (photo, painting, product UI), the
  spacing between sections, the number of colors, and what is *absent*.
- The references set the **craft level**, never the composition to copy.

## Gate 3: Direction, written before code
For each direction (offer **2–3**, never six), write a short contract in `docs/design/<surface>.md`:
- **Thesis:** the one idea this page owns, and the category default it refuses.
- **World:** palette roles (4–6 named tokens) plus a color strategy: *restrained* (neutrals and one
  accent), *committed* (one color owns 30–60% of the surface), or *drenched*. Type: faces, roles,
  and a scale with real steps.
- **First viewport:** an ASCII wireframe of what sits where and at what size, and where the primary
  action is. Test it: if someone saw only this screen, what would they describe an hour later?
- **Signature moment:** one memorable thing. Everything else stays quiet.
- **Assets:** exactly which images, and where they come from (`assets.md`).
- **Self-check:** run `tells.md` § "Defaults" against the plan. If the look could be guessed from
  the category alone ("camping → mountains and pines"), rework it before building.

Directions must differ in **composition and type**, not only in background. Show the owner the
contracts, or quick comps, and let them pick before a full build.

## Gate 4: Assets
**Pictures come from cameras, painters or image models; code draws geometry.** Code is right for
type, layout, maps from real data, diagrams, charts, UI, and crisp vector marks. Code is wrong for
landscapes, skies, animals and "scenes" (canvas/SVG pictures read as clip art; see our record).
Sources, licensing and an image-prompt pack for the owner: `assets.md`. One decisive photo
beats five mediocre ones.

## Gate 5: Build to the craft floor
The floor is mechanics, not direction: `critique.md` § "Craft floor". Main points: measure 60–75ch;
type steps you can see; tight groups with generous separation (more space above a heading than
below); one elevation system (a border *or* a shadow); themed browser surfaces (selection, caret,
focus, scrollbars); every state (hover, focus, disabled, loading, error, empty); one orchestrated
motion moment with a reduced-motion path. House rules still bind: tokens only, contrast pairs in
`src/design/tokens.ts`, never color alone, US spelling.

## Gate 6: Fresh-eyes critique, then the owner
1. Screenshot at 390 and 1440 (plus 768 and 2560 before merge).
2. Spawn a **separate critic agent** that didn't build it. Give it the screenshots, the reference
   screenshots and the contract, using the prompt in `critique.md`. The builder doesn't grade itself.
3. Fix what it finds in one batch, then do one confirming round. **Two rounds is the ceiling**; then
   show the owner, with the references beside the work.
4. Report honestly. If it isn't at the reference bar, say so and say what's missing (usually
   assets). Never call something polished because nothing is broken.

## Deliverable shape for a mockup round
2–3 directions. For each: name, thesis, first viewport at 1440 and 390, one full page, the
references it answers to, and what it would take to finish (assets, copy). Put them side by side.
