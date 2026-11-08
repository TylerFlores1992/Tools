# Rig Planner (`/private/rig`)

Design truss rigs on the phone, approve them, then have Claude build them in Vectorworks through
the connector (`connectors/vectorworks/`, tool `build_rig`). The phone and Vectorworks share one
file, so what was approved is what gets built.

## The two files

1. **Design** (`RigDesign`, `src/tools/rig/types.ts`): a template plus its settings, e.g.
   `{ template: "cube", params: { width: 120, depth: 120, height: 120, truss: "box12", braces: "top" } }`.
   Small, editable by chat, stored in the `rig.designs` table.
2. **Build list** (`BuildList`, `src/tools/rig/build.ts` → `buildList()`): every part resolved to
   clean 3D geometry. This is what the 3D viewer draws, what the rental list counts, and what the
   connector builds. It is computed from the design on demand and saved with it on approval, so the
   connector builds exactly what was shown.

## Build list v1 (the contract with the connector)

Units are **inches**. Axes: **X** right, **Y** away from the front, **Z** up; the floor is Z = 0.
Every vector is `[x, y, z]`. Directions are unit vectors.

```jsonc
{
  "version": 1,
  "name": "10x10x10 cube",
  "units": "in",
  "series": { "id": "box12", "label": "12\" box truss", "width": 12, "height": 12,
              "chordOd": 2, "chordInset": 1 },
  "parts": [
    // A straight section. start/end are the CENTERLINE of the cross-section (not a face).
    // `roll` is degrees about the axis; 0 means the cross-section is square to X/Y/Z.
    { "id": "t1", "kind": "truss", "role": "floor", "length": 96,
      "start": [12, 6, 6], "end": [108, 6, 6], "roll": 0 },
    // A corner block: a cube of `size` centered at `center`. `ways` is the number of faces used.
    { "id": "c1", "kind": "corner", "size": 12, "ways": 3, "center": [6, 6, 6] },
    // A pipe: centerline start → end, outside diameter `od`.
    { "id": "p1", "kind": "pipe", "od": 1.9, "length": 48,
      "start": [8.88, -2, 77.18], "end": [42.82, -2, 111.12] },
    // A swivel coupler (cheeseborough). `at` is on the PIPE's centerline; the other jaw grips the
    // chord at `at + normal * offset`. `pipeDir` and `chordDir` lie in the plane square to
    // `normal`. `normal` points from the pipe toward the chord. `offset` is the distance between
    // the two tubes' centerlines (3" for the library swivel).
    { "id": "k1", "kind": "clamp", "type": "swivel", "at": [11, -2, 79.3],
      "pipeDir": [0.7071, 0, 0.7071], "chordDir": [0, 0, 1], "normal": [0, 1, 0], "offset": 3 }
  ]
}
```

Stage parts (template `stage`, added 2026-11-07):

```jsonc
// A deck: `at` is the library symbol's insertion — plan center, Z = underside of the frame
// (nominal height − 3). `length` runs along X at rotation 0, along Y at 90.
{ "id": "d1", "kind": "deck", "width": 48, "length": 96, "rotation": 0, "height": 24, "at": [48, 24, 21] },
// A leg on the floor; `height` is the deck's nominal height (the leg symbol's name).
{ "id": "l1", "kind": "leg", "height": 24, "at": [1.625, 1.625, 0] },
// Skirting: top line start→end on the walking surface (nominal + 1), hanging `drop` to the floor.
{ "id": "s1", "kind": "skirt", "length": 192, "start": [0, 0, 25], "end": [192, 0, 25], "drop": 25 },
// A guardrail section standing on the edge, `height` above the surface.
{ "id": "r1", "kind": "rail", "length": 96, "start": [0, 96, 25], "end": [96, 96, 25], "height": 42 },
// A stair unit: `at` = middle of its top edge on the floor under the deck edge; runs out along `out`.
{ "id": "st1", "kind": "stairs", "width": 36, "rise": 25, "risers": 4, "run": 33, "at": [96, 0, 0], "out": [0, -1, 0] }
```

Ground-support roof (template `roof`, added 2026-11-07). Its defaults are the **Air Pro
self-climber roof** (Aspect Lighting, Total Structures 20.5" box, 2022), read piece by piece from
its drawing (`Air Pro - Self Climber (09.07.22).vwx`, owner's Dropbox): towers at x ±522.02 and
±254.02, y ±252.25 (bays 22'4" · 42'4" · 22'4", 42'½" across), grid bottom 300" (max trim),
3 × 10' sleeve sections on a 30" base, a 56" head block on top, a 28" self-climber sleeve in the
grid at each tower, 10' long beams, cross beams of 10' + 5' + 4' each side of a center corner
block, and a spine of 10's with 7" + ½" spacers. The tests check every one of those numbers.

- Parts: tower sections are `truss` with role `tower`; sleeves and head blocks are `corner` with
  `role` `sleeve` / `head` (head adds `thick`); tower bases are `baseplate` with size 30.
- The connector draws sleeves as truss stubs and skips head blocks. 20.5" box isn't in
  Vectorworks' library, so since 0.5.3 it builds with the open file's own Total Structures
  symbols (`Truss 20.5" Box 10' (SLV)`, as in the Air Pro drawing) and refuses, in words, in a
  file without them. Not yet tried on real VW: check that those symbols resize like the library's.
- Tower loads (`loads.ts`): the grid's self weight shared by simple spans; the limit defaults to
  2,000 lb (a typical 1-ton self-climber hoist) and is labelled a planning figure until set.
  Aspect publishes no ratings; Total Structures' tower datasheet defers to project calcs.

## What the connector must know about Vectorworks (measured 2026-11-07)

- **Truss:** place the 12" box *symbol*, convert to group, ungroup → a Spotlight `Straight Truss`
  object plus two `MagnetObject`s (delete them). The object's insertion is the **start, centered
  on the width, Z = bottom face**. For a horizontal section, insertion = `start - [0,0,height/2]`.
- **Vertical truss:** set the record field `Hanging Angle` to 90. It pivots so the leg lands
  **6" toward −X** (half the section, since it turns about its bottom face: strictly half the *height*; the same for box truss): place it at `start.x + height/2`. Verified against the
  front, side and top views.
- **Rotate 3D on a hybrid symbol fails** ("Hybrid objects can only be rotated about the Z
  axis"); a 3D-only symbol (the pipes, the clamps) rotates fine.
- **Pipe symbol** (`Pipe 1.5in-4ft Length` etc.): 3D only, insertion at one end on the
  centerline, length along local +X.
- **Swivel clamp** (`Aluminium Scaffold Clamp-45 Deg`): 3D only. Local frame: swivel axis =
  local Z; the upper jaw's bore runs along local X through the origin; the lower jaw's bore runs
  along (1, −1, 0)/√2 at local z = −3. So the pipe goes in the upper jaw and the chord in the
  lower jaw, with local +Z pointing from the chord to the pipe. If the required frame is
  left-handed, use a mirrored copy (Flip Vertical in plan, then put the insertion back at the
  origin: it flips about the bounding-box center, which is 0.031" off).
- Clamps for other brace angles: the library has 0, 15, 30, 45, 60, 75 and 90° versions. Use the
  nearest.
- OIP angle fields read a bare number as degrees; the Rotate 3D dialog keeps its last settings.
- **Stage decks** are plain symbols from `Libraries > Defaults > Stage Deck` (not a parametric
  object: no skirt, rail or stair settings, and the library has no stage skirting, guardrail or
  stair symbols, so the connector skips those and says they're on the rental list). An assembled
  deck (`Stage Deck 4ft x 8ft x 2ft`) is a symbol holding the bare deck (`Stage Deck 4ft x 8ft`)
  and leg symbols (`Stage Deck Leg 24in`). Measured on the 4×8 and 4×4 assemblies: the bare deck's
  insertion is its plan center, long side along X; its frame runs from Z = height − 3 to height,
  with a 1" top above it (walking surface = nominal + 1). Legs stand at Z = 0, 1.625" in from each
  edge: six on a 4×8 (corners and mid long sides), four on a 4×4. Leg symbols exist every 4" from
  8" to 60" (plus 4.25"). The bare decks aren't listed in the library on their own: import an
  assembled deck to bring one in. Decks and legs are hybrid, so they turn about Z only.
- **Missing symbols are imported automatically** (connector 0.5.0): `build_rig` looks the names up
  in Vectorworks' library files (`BuildResourceListN` + `ImportResourceToCurrentFile`), likeliest
  files first, and remembers each file's contents in `~/.vwmcp/library_index.json`. Read straight
  from the files, the bare decks import by name; no assembly needed. Untested on real Vectorworks
  until the first build after installing 0.5.0.

## The page

| Part | Where |
|---|---|
| Templates (cube, goal post, tower, flown grid, stage, ground-support roof), their limits | `src/tools/rig/templates.ts` |
| Design → build list (stock splits, braces, clamps) | `src/tools/rig/build.ts` |
| Rental list, weights, joints | `src/tools/rig/bom.ts` · gear and weights in `catalog.ts` |
| Checks (planning sanity, not engineering) | `src/tools/rig/checks.ts` |
| Plain-words edits; the AI's answer uses the same shape | `src/tools/rig/commands.ts` · `src/lib/rig/ai.ts` |
| Tests (the cube's coordinates are the ones measured in Vectorworks) | `src/tools/rig/rig.test.mts` |
| 3D view (three.js), tap to pick, USDZ for AR Quick Look | `src/tools/rig/ui/RigViewer.tsx`, `scene.ts` |
| Page, panel, chat bar, sheets | `src/tools/rig/ui/RigPlanner.tsx` · `src/app/private/rig/` |
| Storage | `src/lib/rig/store.ts` · `docs/sql/rig-schema.sql` |
| Connector API | `src/app/api/rig/designs/[id]/route.ts` (GET) and `/built` (POST) |
| Contract fixtures | `scripts/rig-fixtures.mts` writes `connectors/vectorworks/tests/fixtures/rig-*.json`; `src/tools/rig/fixtures.test.mts` fails if they drift |

Flow: design on the phone → **Save** (draft) or **Send to Vectorworks** (approves it and freezes the
build list) → at the computer, "build design `<id>`" → the connector fetches it, builds it, and
marks it Built. Editing an approved design puts it back to draft.

## Setup (one time)

1. **Database:** apply `docs/sql/rig-schema.sql` to the Supabase project as migration `rig_schema`.
   Until then the page works and keeps the design on the phone; Save says it isn't set up.
2. **Vercel:** add `RIG_TOKEN` (Sensitive, Production): any long random string. The AI uses the
   existing `MAIL_GEMINI_API_KEY` (or `RIG_GEMINI_API_KEY` if set).
3. **The computer:** `git pull`, re-run `vwmcp-install-plugin` (copies the new bridge), and set
   `VWMCP_RIG_TOKEN` to the same string (see `connectors/vectorworks/README.md`).

## Known limits

- The connector's 3D calls (`Set3DRot` axis order, `Flip3DObj`, `GetSymLoc3D` after rotation,
  resizing a Straight Truss through `LineLength`) are tested against the fake only. Each build
  returns Vectorworks' own read-back of every clamp's orientation: check the first real build.
- 20.5" box builds only in a file that has the Total Structures (SLV) symbols (0.5.3).
- AR is iPhone/iPad (AR Quick Look); other browsers get a sentence saying so.
- Base plates are drawn on the phone and listed to rent; the connector skips them (no symbol yet).
- Stage skirting, guardrails and stairs: drawn on the phone and listed to rent; the connector skips
  them (Vectorworks' library has none). Stage weights and the stair rise (7.5" max) are typical
  planning figures, not a code check.
