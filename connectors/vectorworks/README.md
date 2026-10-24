# Vectorworks connector (vwmcp)

Lets Claude draw in, measure and edit the drawing open in Vectorworks on Windows, Spotlight
included; works a show the way a head rigger does (datum, departments, venue limits, every
point's load, bridles, mark-out, revisions); and powers the live panel at
**tylerflores.dev/private/vectorworks**.

```
Claude ──MCP──▶ vwmcp ─┐                      ┌─▶ %USERPROFILE%\.vwmcp\jobs\<id>.json
                       ├─ the same job queue ─┤
Panel page ──HTTP──▶ vwmcp-panel ─┘           └─ presses Ctrl+Shift+Alt+M in Vectorworks
                                                        │
Vectorworks: "MCP Run Job" ▶ vwmcp_bridge.run_pending() ▶ runs each job with `vs`
                                                        ▶ results\<id>.json ▶ back to the caller
```

## Status

| Piece | State |
|---|---|
| MCP server, 52 tools (54 with the optional ones), job queue (retry, timeout, stale-job drop) | Tested over real MCP stdio |
| Bridge inside Vectorworks | Every `vs` call checked against the official signatures; tested against a strict fake of Vectorworks. **Not yet run in a real copy of Vectorworks.** |
| Windows hotkey trigger | Logic tested with Windows faked out; **not yet run on Windows** |
| Panel API (`vwmcp-panel`) + the page on tylerflores.dev | Tested end to end in a real browser against the fake |

## Set up (Windows, Vectorworks 2026 with Spotlight)

1. **Install** (Python 3.11 or newer, from this folder):
   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   pip install -e ".[windows]"
   vwmcp-install-plugin
   ```
   This copies the bridge to `%USERPROFILE%\.vwmcp\plugin` and prints two short scripts.

2. **Create two menu commands.** Tools ▸ Plug-ins ▸ Plug-in Manager ▸ Custom Plug-ins ▸ New ▸
   **Command**. Name it `MCP Run Job`, then Edit Script, set the language to **Python**, and paste
   the first script. Do the same for `MCP Session` with the second script.

3. **Add them to your workspace.** Tools ▸ Workspaces ▸ Edit Current Workspace ▸ Menus. Drag
   both into any menu, then give `MCP Run Job` the shortcut **Ctrl+Shift+Alt+M**. If you pick
   another key, set `VWMCP_HOTKEY` to match, in
   [pywinauto syntax](https://pywinauto.readthedocs.io/en/latest/code/pywinauto.keyboard.html):
   `^` Ctrl, `+` Shift, `%` Alt.

4. **Connect Claude.**
   - Claude Code: `claude mcp add vectorworks -- C:\path\to\this\folder\.venv\Scripts\vwmcp.exe`
   - Claude Desktop (`claude_desktop_config.json`):
     ```json
     { "mcpServers": { "vectorworks": { "command": "C:\\path\\to\\this\\folder\\.venv\\Scripts\\vwmcp.exe" } } }
     ```
   Open a drawing and ask Claude to "ping Vectorworks".

5. **The panel (optional).** Run `vwmcp-panel` and open the link it prints. The page pairs with
   this computer and keeps the token in that browser only. The drawing goes straight from your
   computer to the page, never through the website.

**Session mode, if the shortcut misbehaves:** set `VWMCP_TRIGGER=session` and run
**MCP Session**. A small "Claude is connected" window handles requests every quarter second
until you press Stop. It uses Vectorworks' dialog timer, the only timer a script gets.

## First run on real Vectorworks

Do these once, in order, and note anything odd.

1. `ping`: expect `2026 (31.x.x, build …)`, `Windows`, and your units.
2. `vs_lookup query=HMove`: confirms the live API answers, with its signatures.
3. Draw a line and a rectangle, `get_selection` on them, then `undo_last` twice.
4. `get_lighting_devices` on a real plot: check the field names match the table below. If
   Spotlight names a field differently, the panel's fixture fields are in `FIXTURE_FIELDS`
   (`src/tools/vectorworks/ui/Inspector.tsx`).
5. `screenshot`: needs Pillow, which the `[windows]` extra installs.
6. On a real rigging file, `survey_drawing`, then `get_rigging include_fixtures=false`. Check:
   - **Plug-in names.** Each hoist, house point, bridle, truss and load should come back with
     the kind you expect. If one reads as `other`, add its plug-in name to `RIGGING_KINDS` in
     `vw_plugin/vwmcp_bridge.py` (the survey's "Plug-in objects found" lists the exact names).
   - **Heights.** Compare a hoist's `z` with its Object Info height. If they differ by the layer
     elevation, `z` is relative to the layer and the bridge needs `GetLayerElevationN` added.
   - **Viewports.** Objects inside a design layer viewport should say `source: viewport` (or
     `referenced`), never `native`. If one says `native`, `GetParent` doesn't reach viewports
     and `_note_native` is the only thing classifying them.
   - **Braceworks.** If Braceworks has calculated, `load_source` should say `Braceworks`. If it
     says `statics` or `estimate` on a calculated file, the field names differ: read one hoist
     with `get_object include_records=true` and fix the names in `_describe`.
7. `import_dwg` with a venue DWG into a new layer, then `check_scale`. Note what
   `ImportDXFDWGFile` returned on success and on a bad path; the bridge treats 0 as success.

The same list is what the panel's Rigging tab shows, so a wrong kind or height shows there too.

If a **Script Errors** dialog ever appears, a `vs` call disagreed with Vectorworks. Click OK,
copy what it says, and fix that call in `vw_plugin/vwmcp_bridge.py`. The menu command reloads
the bridge on every run, so there's no need to restart Vectorworks.

## Working a show (how a head rigger does it)

Files arrive two ways: **one file** with everyone's work on layers and classes, or **separate
files** (venue, lighting, audio, video, scenic) referenced in as design layer viewports or
imported. Either way the steps are the same, and Claude follows them (they're in the server's
instructions):

1. **See what arrived.** `survey_drawing` names every layer and class, each viewport and the
   file behind it, which plug-in types are present and how each will be read, and anything
   referenced (read-only here: change it in its own file). `check_scale` catches a venue DWG
   that came in at the wrong scale (inches vs millimeters, feet vs inches); `scale_objects`
   fixes it.
2. **Set the datum.** `find_reference_lines` suggests the centerline and plaster line (or DSE);
   `set_datum` stores where they cross and which way upstage is. Every position is then given
   the way it's called out on the floor: `12'-0" SL of CL, 30'-0" US of PL`.
3. **Departments.** Guessed from layer and class names (venue, rigging, lighting, audio, video,
   scenic, staging); `set_departments` fixes any guess, remembered per file.
   `show_departments` turns them on, gray or off, in Vectorworks and in the panel alike.
4. **Venue limits**, from the venue's rigging packet: per point, per beam, roof total, high
   steel, max bridle angle (120° default), weights of truss, cable and chain per foot
   (`set_limits`, in lb or kg).
5. **Work out the rigging.** `rigging_report` gives every point's load and where it came from
   (Braceworks when calculated; otherwise statics for two picks, a continuous-beam estimate for
   three or more, or a load object), the point load with hoist and chain, the dynamic factor,
   use of the hoist's rating, the steel above (dead hang, or a bridle between beams on opposite
   sides with leg lengths and angle), checks worst first, beam and roof totals, and the
   mark-out order. `save_csv` writes the point list beside the drawing.
6. **Revisions.** `save_rigging_revision` keeps the point list; later reports say what was
   added, removed, moved or changed load since.

Tools for the math on its own: `design_bridle` (apex and hook height to legs and tensions),
`bridle_from_legs` (fixed legs to where the apex lands), `truss_loads` (reactions on each pick).
Show settings live in `%USERPROFILE%\.vwmcp\shows\`, one file per drawing.

**Estimates are estimates.** Three or more picks on one truss depend on how level the hoists
are; the report says so on every such point. Check with Braceworks, load cells or an engineer
before anything flies.

## Why it's built this way

These come from the official reference (github.com/Vectorworks/developer-scripting, which
developer.vectorworks.net now redirects to) and from a macOS project tested on VW 2026 U3
(giorgiomoroder/vectorworks-mcp).

- **Vectorworks 2026 runs Python 3.9.2.** `tests/test_bridge_static.py` parses the bridge as 3.9.
- **A wrong `vs` call doesn't raise.** It queues a modal Script Errors dialog that blocks the
  app. So `vw_plugin/vs_signatures.json` records the official parameter list of every function
  the bridge calls, and a test fails if any call's argument count or point-tuple form disagrees.
  The fake Vectorworks enforces the same table at run time. Where the reference contradicted
  itself (`Rect` is documented as four numbers but bound as two points), the Python binding wins.
- **Nothing can host a server inside Vectorworks**, and there is no outside API for a running
  copy. So the work goes through a menu command, woken by a shortcut.
- **The trigger is polite.** If you're working in Vectorworks, it waits until your mouse buttons
  are up and you've paused (`VWMCP_IDLE_MS`, default 600), so it never lands mid-drag. From
  another app it fires at once and hands focus back. It refuses while a Vectorworks dialog is
  open, and in the first 30 seconds after launch, because scripting a just-started Vectorworks
  can crash it.
- **Objects are addressed by UUID** (`GetObjectUuid`), because handles only live for one run.
  `GetName` says `"none"` for unnamed objects; the bridge reports `""`.
- **Ctrl+Z merges consecutive scripted runs**, so the bridge keeps its own journal and
  `undo_last` reverses Claude's changes one at a time. A batch counts as one change. Deletes,
  color changes and new layers say they need Ctrl+Z.
- **ResetObject applies at the end of a run.** So moves report the exact new geometry by
  translating what was read, rather than re-reading stale plug-in objects.
- **Lighting Device Universe and DMX Address** are written together as `UniverseAddress`
  (`2/101`). Spotlight overwrites either one written alone.
- **Fixtures are only placed with symbols already in the file** (`list_symbols`). A lighting
  device pointing at a missing symbol can damage a .vwx.
- **Referenced files have no script API.** Objects from a referenced viewport are found by
  searching with and without `NOTINREFDLVP`/`NOTINDLVP`, labeled by source, and refused for
  edits, so nothing tries to change a file that isn't open.
- **No script can export the view**, so `screenshot` captures the Vectorworks window itself.
  `snapshot` draws an SVG from geometry and works everywhere.

## Tools

| Group | Tools |
|---|---|
| Document | `ping`, `get_document_info`, `create_layer`, `create_class` |
| Draw | `draw_line`, `draw_rectangle`, `draw_circle`, `draw_arc`, `draw_polygon`, `add_text`, `add_dimension`, `draw_wall`, `place_symbol`, `list_symbols` |
| Read & measure | `list_objects`, `get_selection`, `get_object`, `measure_distance` |
| Edit | `move_objects`, `rotate_object`, `duplicate_objects`, `set_object_properties`, `set_attributes`, `group_objects`, `delete_objects`, `select_objects`, `zoom_to` |
| Spotlight | `get_lighting_devices`, `set_record_fields`, `place_lighting_device` |
| Show setup | `survey_drawing`, `get_show_setup`, `find_reference_lines`, `set_datum`, `set_departments`, `set_limits`, `show_departments`, `where_is` |
| Rigging | `get_rigging`, `rigging_report`, `save_rigging_revision`, `design_bridle`, `bridle_from_legs`, `truss_loads` |
| Venue files | `import_dwg`, `check_scale`, `scale_objects` |
| Workflow | `batch` (many steps, one round trip, one undo), `undo_last`, `vs_lookup` |
| Look | `screenshot` (Windows), `snapshot` (SVG) |
| Optional | `run_python` (needs `VWMCP_ALLOW_EXEC=1` and a file named `allow_exec` in `%USERPROFILE%\.vwmcp`); `end_session` (session mode) |

Lengths may be numbers (drawing units) or strings with units: `12'-6"`, `6 1/2"`, `20 ft`,
`450mm`, `1.2 m`. The panel reads them with the same rules, tested against the same cases
(`src/tools/vectorworks/length-cases.json`).

Lighting Device fields seen in Spotlight 2026: Inst Type, Channel, Unit Number, Position,
Purpose, Color, Wattage, Dimmer, Universe, DMX Address, UniverseAddress, Absolute Address,
Circuit Number, Circuit Name, Template, Template2, Focus, Mark, Symbol Name, Device Type,
User Field 1–6. `get_lighting_devices` lists whatever your version actually has.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `VWMCP_TRIGGER` | `hotkey` | `hotkey`, `session`, or `none` (fake/dev) |
| `VWMCP_HOTKEY` | `^+%m` | Shortcut bound to MCP Run Job |
| `VWMCP_IDLE_MS` | `600` | How long you must pause in Vectorworks before a request runs |
| `VWMCP_WINDOW_RE` | `.*Vectorworks.*` | Window title to find |
| `VWMCP_RESTORE_FOCUS` | `1` | Hand focus back to where you were |
| `VWMCP_TIMEOUT` | `30` | Seconds to wait for Vectorworks |
| `VWMCP_REFIRE_AFTER` | `3` | Press again if a job sits unclaimed this long |
| `VWMCP_ALLOW_EXEC` | `0` | Offer `run_python` |
| `VWMCP_PANEL_PORT` | `7377` | Panel API port (always 127.0.0.1) |
| `VWMCP_PANEL_ORIGINS` | tylerflores.dev, localhost:3000 | Pages allowed to use the panel API |
| `VWMCP_HOME` | `%USERPROFILE%\.vwmcp` | Queue, journal, token, installed bridge |

## Panel API safety

`vwmcp-panel` binds 127.0.0.1 only. Every call except `/api/health` needs the pairing token
(`%USERPROFILE%\.vwmcp\panel_token`). Browsers may only call it from `VWMCP_PANEL_ORIGINS`.
The Host header must be localhost, which blocks DNS rebinding. Only an allow-list of operations
runs; `run_python` never does. Each of these has a test that fails if the guard is removed.

## Develop without Vectorworks

```powershell
pip install -e ".[dev]"
pytest                                    # against a strict fake Vectorworks
python dev\fake_vectorworks.py --demo     # a plot with a deck, a truss and 4 fixtures
python dev\fake_vectorworks.py --show     # a rigging file: steel, 2 trusses on 5 hoists,
                                          # 12 fixtures, scenery, a referenced audio file
```

With the fake running, `VWMCP_TRIGGER=none vwmcp-panel` and the MCP server both work end to
end, on any OS.

## Layout

```
src/vwmcp/     server.py (MCP tools) · panel.py (local HTTP API) · jobs.py (queue) ·
               trigger.py (hotkey, idle wait, guards, capture) · svg.py · install.py · config.py
               service.py (show workflow) · show.py (datum, departments, limits, per file) ·
               rigging.py (bridles, truss reactions, units) · report.py (point list, checks)
vw_plugin/     vwmcp_bridge.py (runs in Vectorworks) · menu_run_job.py · menu_session.py ·
               vs_signatures.json (official parameter lists for every vs call used)
dev/           fake_vs.py (strict in-memory Vectorworks) · fake_vectorworks.py (queue watcher)
tests/         bridge static checks, round trips, units, trigger, panel API, rigging math,
               show setup, the head-rigger workflow end to end
make_zip.py    builds the download behind /private/vectorworks
```
