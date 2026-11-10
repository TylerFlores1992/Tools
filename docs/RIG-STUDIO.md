# Rig Studio

The pinned Claude page that holds every rig project: **https://claude.ai/artifact/PuRp9wC1DjALUMwfWQYmk5**
(private to Tyler, pinned in the claude.ai sidebar). Source in `studio/rig-studio/`, rig maths in
`src/tools/rig/sketch.ts` and `sketchOps.ts` (tested in `sketch.test.mts`).

What it does:
- **Projects, all blank.** Each card has a ⋯ menu: pin to the top, archive (off the list, nothing
  deleted) or delete for good (versions, layers, chat, pictures and its session records). No templates. Each one has a free-form *sketch* (truss runs, towers,
  hoists, hung loads), a version history, reference layers, a chat and a Dropbox folder.
- **The view.** 3D, plan, front and side, from the same scene code as the Rig Planner
  (`src/tools/rig/ui/scene.ts`), with load labels on every hoist and tower.
- **Chat bar.** Pictures can go with a message (paste, or drop onto the box; kept as page assets so a full
  session can open them too). Claude inside the page (the artifact `sample` capability) edits the sketch with
  page tools (`edit_rig`, `replace_rig`, `read_layer`) and saves one version per request.
- **Full sessions for big jobs.** "Start a full session" (or Claude's own `start_session` tool)
  writes a `jobs/{id}` document and fires one of two scheduled tasks with `fire_trigger`; the new
  session reads and writes the page's database with the ArtifactData tool, and the page shows its
  progress live. Cloud worker for drawing work; PC worker (requires Tyler's computer) for
  Vectorworks and local files.
- **Dropbox.** One folder per project (made as `/Rig Studio/<name>` or linked). The page lists it
  every 2 minutes and flags new or changed files. The page can't download from Dropbox (its CSP
  and the connector only give metadata), so reading a file goes to a PC session.
- **Vectorworks files with the PC off.** Nothing outside Vectorworks reads .vwx (closed format;
  Dropbox's reader stops at 5 MB and can't preview it), so each file goes through Vectorworks
  once: the connector's `read_out` (or `read_out_folder`) writes `<name>.rigread.json` beside the
  .vwx: layers (with whether they're shown), classes, every plug-in object with its fields
  (lighting devices, truss, hoists), symbols, and the shapes the drawing is made of: inside groups
  and inside every symbol (moved, turned and scaled to where it sits), 3D objects as blocks with
  their bottom, height and fill colour; a symbol with a 3D part gives its 3D part, a symbol with
  more than 150 parts (people, cameras) one block. Inches, kept under 5 MB. Rig Studio draws the
  blocks merged per colour, so a whole set (CFF-26: 13k shapes) opens in about 4 s.
  Since 0.7.0 every 3D object (extrudes, sweeps, meshes, solids, walls, 3D plug-ins) comes with its
  real faces: ConvertTo3DPolys REPLACES the object it's given (0.7.0-0.7.1 converted the drawing's own
  objects and so deleted them from the open document; found 2026-11-10 on a throwaway CFF copy), so since
  0.7.2 it only gets an HDuplicate, which is read and deleted (GetPolyPt3D counts from 0). `mesh: {q: 0.25, v: corners in quarter inches, f: [n, i..]}`.
  CFF-26: 67,708 faces in ~5 s. Symbols only become one block past 2,500 parts (was 150). Over 4.8 MB
  the faces move to `<drawing>.rigmesh<n>.json` parts (main file lists `mesh_parts`, objects keep
  `mid`); Rig Studio fetches them and draws the faces solid in the drawing's colours, edges over 30°.
  Since 0.9.0 the read-out also carries what makes the plan look like Vectorworks: each object's pen
  colour (`pen`, absent = black), weight in mils past hairline (`lw`), no outline (`np`), hatch (`hatch`,
  drawn here as 45° lines every 6"), texts and dimensions (`t: "text"|"dimension"`, `at` = middle of the
  text's box, `size` = letter height in inches from that box, `rot`), and `hid: 1` on objects in a class
  switched off in Vectorworks (GetCVis = -1, inherited by a symbol's parts), which Rig Studio leaves out.
  Rig Studio draws heavy pens as fat lines, keeps texts readable (a mirrored symbol's angle can't be read)
  and has a Paper switch (on by default): white behind the drawing as in Vectorworks; on the page's dark
  background dark pens are lifted and see-through fills read darker (CFF's 22% cream floor looks olive).
  Not yet read: a sheet's viewport overrides (its own class and layer visibility), so a read-out matches
  the design layers, not a sheet (CFF's A-1 viewport hides the yellow floor areas the design layer shows).
  Measured quirks: GetSymLoc3D's x, y are from the internal origin (use GetSymLoc); inside a symbol
  definition every point (GetBBox, GetSegPt, GetPolyPt, GetSymLoc, GetPolyPt3D) reads back as true − user
  origin, so 0.7.1 adds the user origin back before placing it (CFF-26: 3 → 356 of 362 symbols aligned); opening an older
  file stops on a 'convert' prompt, which the connector accepts by itself; the converted copy is unsaved, so
  after the read-out the connector closes it without saving (0.6.1; File > Close, then No only to a save prompt
  naming that copy), and answers No (don't ask again) to the 30-minute 'name and save for backup?' box. In a Dropbox folder it syncs; the Files tab
  then opens it (Dropbox `fetch`) as layers: fixtures, the existing rig, outlines per Vectorworks
  layer (`studio/rig-studio/src/readout.ts`). "Read it out on my PC" does NOT use a scheduled task
  (measured 2026-11-10: a run the page starts never gets the link to the PC, even with "Require this
  computer" on). It leaves `<drawing>.<job>.rigrequest.json` beside the drawing in Dropbox; the
  connector (0.6.2+) looks in Dropbox's "Rig Studio" folder (from Dropbox's info.json; or
  `VWMCP_REQUESTS`) every 5 s, reads the drawing out, and writes `<drawing>.rigstatus.json`
  {job, state reading|done|failed, message}. The page looks every 10 s while a request is out and
  shows the PC's words under the file; no pickup in 20 min says so. A sleeping PC is woken first
  by the cloud worker (wake only); the request waits in Dropbox meanwhile.
  With `VWMCP_WATCH` set on the PC (connector 0.5.6+), new or changed .vwx files in those folders
  are read out by themselves once nobody has touched the PC or Claude for 10 minutes.
- **The PC can be asleep.** With `wake: true` in `config/workers` (and the waker's `{url, token}` in
  `config/pcwaker`), a PC job starts as `status: "waking"` and fires the cloud worker with the line
  `wake the PC for job <id>`: it checks the PC, wakes it if asleep, and sets `awake: true`. The
  page then fires the PC worker itself with the job's `text` and marks it `handed` (an unattended
  session may not start another scheduled task; `routeJob`/`needsHandoff` in `model.ts`). A file
  job keeps `file` (the Dropbox id): its status shows under that file and its button waits while it
  runs. The waker runs on the CampHawk mini PC (`desktop-mdc5q6e`), setup in `connectors/pc-waker/`.
  The PC worker scheduled task must have "Require this computer" on (it does: DESKTOP-M9OCUDL).
- **Layers.** PDF (rendered with pdf.js), PNG and JPG drawings sit under the rig to scale; CSV
  fixture lists and Vectorworks lighting devices become fixtures whose weight can count on the rig.
- **Approve, then build.** Only the approved version is built. In the Claude desktop app on the PC
  the page calls the connector directly (`host:vectorworks` → `build_rig`); anywhere else Build
  starts a PC session to do it.

## Sketch format (inches; X right, Y away from the front, Z up, floor Z = 0)

```jsonc
{
  "version": 1, "name": "Tennis court roof", "series": "box12" | "box20",
  "runs":   [{ "id": "r1", "a": [x, y, z], "b": [x, y, z], "label": "Upstage" }],   // joint centre to joint centre
  "towers": [{ "id": "t1", "x": 0, "y": 0, "height": 360 }],                          // height optional
  "points": [{ "id": "p1", "at": [x, y, z], "kind": "hoist" | "deadhang", "capacity": 2000 }],
  "loads":  [{ "id": "l1", "at": [x, y, z], "lb": 300, "label": "L-Acoustics K2 hang" }],
  "towerLimit": 2000
}
```

- Run ends that meet (within ½") are one joint: two runs in a straight line join with no block;
  anything else gets a corner block; a joint above a tower gets that tower's sleeve block. Runs
  are filled with stock sections between the blocks; when no stock adds up, the build list says so.
- Grid Z is the truss centerline (trim + half the truss height).
- The Vectorworks connector builds runs that are level along X or Y, or plumb. Others are flagged.
- Checks are planning figures: each piece's weight goes to its two nearest supports by inverse
  distance; spans against 30' (12" box) or 40' (20.5"); cantilevers over 4'.

Command line (what sessions use): `npx tsx scripts/rig-sketch.mts check|build|rental <file> [layers.json]`.

## Database (the artifact's `db`; ArtifactData with `url` = the page above)

| Path | Shape |
|---|---|
| `projects/{pid}` | `{name, createdAt, updatedAt, status: "draft"\|"approved"\|"built", current, approved, built, archived?, pinnedAt?, dropbox: {path, display}\|null, seen: {fileId: modified}, thumb}` |
| `projects/{pid}/versions/v0001` | `{n, note, by: "you"\|"claude"\|"session", at, sketch, approvedAt?}` (id is `v` + 4 digits) |
| `projects/{pid}/layers/{lid}` | `{name, kind: "image"\|"fixtures"\|"shapes", visible, at, source?, …}`: image `{asset, px:[w,h], widthIn, x, y, z, rot, opacity}`; fixtures `{fixtures:[{x,y,z,lb,type}], onRig}`; shapes `{shapes:[{pts:[[x,y]…], z, closed, label}]}` |
| `projects/{pid}/chat/{mid}` | `{role: "you"\|"claude"\|"session", text, at, job?, version?}` |
| `jobs/{jid}` | `{pid, project, request, where: "cloud"\|"pc", status: "queued"\|"running"\|"done"\|"failed", progress, reply, at, updated, session?, version?, archived?, pinnedAt?}` (Home lists them with the same ⋯ menu as projects) |
| `config/workers` | `{cloud: trig_…, pc: trig_…}`: the two scheduled tasks |

A session saving a version: write `versions/v000N` (N = project `current` + 1), then update the
project `{current: N, updatedAt, status: "draft"}`, post a `chat` message with `role: "session"`,
`job` and `version`, and finish the job (`status: "done"`, `reply`, `version`). Pin every write
with `if_version`.

## Workers (scheduled tasks, fire-only)

| | Trigger | Runs |
|---|---|---|
| Cloud worker | `config/workers.cloud` | in the cloud: drawing and checking work |
| PC worker | `config/workers.pc` | with Tyler's PC: Vectorworks connector, local and Dropbox files |

Their full prompts are in `studio/rig-studio/workers.md`. Fire one by hand to test:
`fire_trigger(trigger_id, text: "Rig Studio job <jid>\nproject: <pid> …")` after writing the job.

## Building and testing the page

```
npx tsx studio/rig-studio/build.mts          # → studio/rig-studio/dist/rig-studio.html
node studio/rig-studio/dev/test.mjs          # browser flows against a mock window.claude + screenshots
```

Publish with the Artifact tool, same file path in the session that made it, or with `url` from
another session (read it first). Keep the capabilities: `db`, `user`, `sample`, `assets`,
`downloads`, `sample` with `images: true` (pictures in the chat), and `mcp` with Claude Code Remote [fire_trigger], Dropbox [list_folder,
get_file_metadata, create_folder, fetch, create_file] and host:vectorworks [ping, build_rig, get_lighting_devices,
get_document_info].
