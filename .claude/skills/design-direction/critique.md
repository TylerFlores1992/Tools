# Critique: the craft floor and the critic's brief

## Craft floor (check on the rendered result, not the code)
- **Contrast:** body ≥4.5:1, large ≥3:1, measured on the pixels when over imagery. On colored grounds,
  tint secondary text from that hue; never use plain grey.
- **Type:** body measure 60–75ch; visible scale steps (display at least 2.5× body on Persuade pages);
  tracking no tighter than −0.03em; balanced headings; real copy at every breakpoint with no overflow.
- **Space:** one spacing rhythm; tight groups, generous separation; more space above a heading than
  below; the first viewport holds the thesis, not just a header.
- **Depth:** one elevation system, a border *or* a shadow, not both as decoration. Shadows have
  offset and blur; no glows.
- **Browser surfaces:** text selection, caret, focus rings, scrollbars, link underline offset and
  tabular numerals, all themed from the palette.
- **States:** hover, focus, active, disabled, loading, error and empty.
- **Motion:** one orchestrated moment, ease-out, from an already-visible default; reduced-motion path.
- **Imagery:** real (see `assets.md`), one art direction, art-directed crops per breakpoint.

## The critic agent's brief (paste into the Agent tool, fill the blanks)
> You are a senior product designer reviewing work by someone else. You did not build it, and you
> owe it no kindness. Images attached: the work at 1440 and 390 (`<paths>`) and the references
> (`<paths>`). The direction contract is `<path>`.
>
> 1. **Five-second read:** what draws the eye first, what the page is for, and the emotional register.
>    Is that what the contract promised?
> 2. **Reference bar:** for each reference, would this sit beside it without looking cheaper? Name the
>    specific gap: imagery, type scale, spacing, density, detail.
> 3. **Tells:** list every item from `.claude/skills/design-direction/tells.md` you can see, with its location.
> 4. **Hierarchy and usability:** reading order, primary action, anything competing with it.
> 5. **Craft floor:** list the failures from `.claude/skills/design-direction/critique.md`.
> 6. **Score:** 1–10 against the references (10 = indistinguishable in craft), and a verdict: *ship*,
>    *fix then ship*, or *rethink*. Then the three changes that would raise the score most, most
>    impactful first.
>
> Be concrete ("the 13px card text is too small against the 44px headline for this density"), not
> vague ("feels off"). Don't praise without a reason.

## How to use the result
- Below 7, or a *rethink* verdict: go back to Gate 3 or Gate 4. Usually the assets or the composition
  are the problem, not the CSS.
- Fix everything from one critique in one batch, run a confirming critique, then stop (two rounds max).
- Show the owner the critic's score and gaps alongside the screenshots. Don't hide a weak score.
