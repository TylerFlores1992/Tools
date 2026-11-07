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
