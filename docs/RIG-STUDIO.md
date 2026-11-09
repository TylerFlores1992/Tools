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
| `jobs/{jid}` | `{pid, project, request, where: "cloud"\|"pc", status: "queued"\|"running"\|"done"\|"failed", progress, reply, at, updated, session?, version?}` |
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
get_file_metadata, create_folder] and host:vectorworks [ping, build_rig, get_lighting_devices,
get_document_info].
