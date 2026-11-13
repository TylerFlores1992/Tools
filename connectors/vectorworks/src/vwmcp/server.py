"""The MCP server Claude talks to. Each tool queues one job for the bridge inside Vectorworks.

Lengths: a number is in the drawing's own units; a string can carry its unit the way a rigger
writes it: "12'-6\"", "6 1/2\"", "20 ft", "450mm", "1.2 m". Points are [x, y] of either.
Objects are referred to by the `id` (a UUID) returned when they're created or listed.
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import sys
import time
from pathlib import Path
from typing import Any, Literal, Union

from mcp.server.mcpserver import Image, MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from . import __version__, config, readout, rig, symbols, update
from .jobs import BUSY_DIR, BridgeError, BridgeTimeout, JobQueue
from .rigging import apex_from_legs, leg_parts, solve_bridle, truss_reactions
from .service import Show
from .svg import render_svg
from .trigger import HotkeyTrigger, TriggerError, make_trigger

# Objects in one read-out at most (a guard, not a target: CFF-26 with its game board drawn whole is ~40,000).
MAX_OBJECTS = 60000
# How long a read-out waits for the designer to answer a box Vectorworks shows (then it says so).
ASK_WAIT_S = 1200

Length = Union[float, str]
Point = list[Length]

INSTRUCTIONS = """\
Draw in, measure and edit the drawing open in Vectorworks (with Spotlight support).

- Call `ping` first: document, Vectorworks version, units, how many objects are selected.
- Lengths: numbers are in drawing units; strings may carry a unit: "12'-6\\"", "450mm", "20 ft".
- Objects have an `id`. "This"/"these"/"what I selected" means get_selection.
- Several drawing steps? Use `batch`: one Vectorworks round trip, and one `undo_last` undoes it.
- After drawing, check your work: `screenshot` (the real Vectorworks window, Windows only) or
  `snapshot` (an SVG built from geometry, works everywhere).
- Ctrl+Z in Vectorworks merges Claude's consecutive edits; `undo_last` reverses them one at a
  time (moves, rotations, new objects, field edits). Deletes and color changes say they can't be.
- Lighting: get_lighting_devices, set_record_fields (record "Lighting Device"), place_lighting_device.
  Universe/DMX are written together as UniverseAddress (e.g. "2/101"). Only use symbols that
  list_symbols shows: a missing fixture symbol can damage a file.
- Unsure of a vs function? `vs_lookup` searches the live API with its signatures.
- 3D rigs: "build design <id>" means `build_rig(design_id=...)`: one call builds an approved Rig
  Planner design (truss, corner blocks, pipes, clamps). It reports parts it skipped, nearest
  library parts it used, and symbols to import first. 3D tools take INCHES, Z up.

Working like a head rigger (any mix of files):
1. `survey_drawing`: what arrived (layers, departments, referenced files, viewports, DWG
   content, plug-in types and their real field names) and what to sort out first.
2. Set the datum (`find_reference_lines`, then `set_datum`), departments (`set_departments`),
   and the venue's limits (`set_limits`: per point, per beam, roof total, steel height...).
3. `rigging_report`: every point with its load (Braceworks result, statics, or an estimate),
   dead hang or bridle, checks against hoist and venue limits, beam and roof totals, a mark-out
   list and a CSV. `save_rigging_revision` before changes; the next report says what moved.
4. Positions are said the rigger's way ("12'-0" SL of CL, 30'-0" US of PL"): `where_is`.
- Objects from referenced files are read-only; say so and edit them in their own file.
- Loads on 3+ pick points are estimates: say so, and point to Braceworks, load cells or an engineer.
"""


def build_server(settings: config.Settings | None = None) -> MCPServer:
    settings = settings or config.load()
    trigger = make_trigger(settings)
    queue = JobQueue(settings, trigger)
    show = Show(queue, settings.home)
    last_claude = [0.0]  # monotonic time of Claude's last request to Vectorworks

    @contextlib.asynccontextmanager
    async def lifespan(_server):
        task = asyncio.create_task(watch_loop()) if readout.watch_folders() else None
        req_task = asyncio.create_task(request_loop())
        try:
            yield {}
        finally:
            req_task.cancel()
            if task:
                task.cancel()

    mcp = MCPServer("vectorworks", instructions=INSTRUCTIONS, version=__version__, lifespan=lifespan)

    def pending_prompt() -> dict | None:
        """A box Vectorworks is waiting on that the connector can't answer by itself."""
        try:
            return getattr(trigger, "pending_prompt", lambda: None)()
        except Exception:
            return None

    async def guarded(coro):
        try:
            return await coro
        except (BridgeError, BridgeTimeout, TriggerError, ValueError) as e:
            raise ToolError(str(e)) from e

    async def call(op: str, _watch: bool = False, **args: Any) -> Any:
        if not _watch:
            last_claude[0] = time.monotonic()
        try:
            return await queue.call(op, **{k: v for k, v in args.items() if v is not None})
        except (BridgeError, BridgeTimeout, TriggerError) as e:
            raise ToolError(str(e)) from e  # shown to Claude as a readable tool error

    # ---- document --------------------------------------------------------------------

    @mcp.tool()
    async def ping() -> dict:
        """Check the connection: document, Vectorworks version, units, selection count, and this
        connector's version and symbol map."""
        out = await call("ping")
        if isinstance(out, dict):
            out["connector"] = __version__
            out["symbols"] = STARTUP.get("symbols", "built-in")
            if STARTUP.get("update"):
                out["update"] = STARTUP["update"]
            folders = readout.watch_folders()
            out["watching"] = [str(f) for f in folders] if folders else "nothing (set VWMCP_WATCH to read out new files by itself)"
            out["requests"] = [str(f) for f in readout.request_folders()] or "no Dropbox 'Rig Studio' folder found (set VWMCP_REQUESTS)"
        return out

    @mcp.tool()
    async def update_connector(install: bool = True) -> dict:
        """Check tylerflores.dev for a newer connector (and refresh the symbol map). With
        install=true a newer build is downloaded, checked and installed, and the Vectorworks
        bridge is updated at once; the rest takes effect the next time the Claude app starts the
        connector. It also updates by itself at every start unless VWMCP_AUTO_UPDATE=0."""
        token = config.rig_token(settings)
        sym = await asyncio.to_thread(symbols.refresh, settings.rig_url, token, settings.home, 8.0, True)
        try:
            m = await asyncio.to_thread(update.check, settings.rig_url, token)
        except update.UpdateError as e:
            return {"installed": __version__, "symbols": sym, "error": str(e)}
        if not m["newer"] or not install:
            return {"installed": __version__, "latest": m["version"], "newer": m["newer"], "symbols": sym}
        try:
            res = await asyncio.to_thread(update.install, settings.rig_url, token, m, settings.plugin_dir)
        except update.UpdateError as e:
            raise ToolError(str(e)) from e
        return {**res, "symbols": sym, "note": "Installed. The Vectorworks bridge is updated now; restart the Claude app to load the new server code."}

    @mcp.tool()
    async def get_document_info() -> dict:
        """Document name, units, every layer (design or sheet) and class, the active ones."""
        return await call("get_document_info")

    @mcp.tool()
    async def create_layer(name: str, activate: bool = True) -> dict:
        """Create a design layer (or reuse it if it exists) and optionally make it active."""
        return await call("create_layer", name=name, activate=activate)

    @mcp.tool()
    async def create_class(name: str, activate: bool = False) -> dict:
        """Create a class (or reuse it) and optionally make it active."""
        return await call("create_class", name=name, activate=activate)

    # ---- drawing ---------------------------------------------------------------------

    @mcp.tool()
    async def draw_line(start: Point, end: Point, layer: str | None = None, cls: str | None = None, name: str | None = None) -> dict:
        """Draw a straight line. Returns the new object with its length."""
        return await call("draw_line", start=start, end=end, layer=layer, cls=cls, name=name)

    @mcp.tool()
    async def draw_rectangle(corner1: Point, corner2: Point, layer: str | None = None, cls: str | None = None, name: str | None = None) -> dict:
        """Draw an axis-aligned rectangle from two opposite corners."""
        return await call("draw_rectangle", corner1=corner1, corner2=corner2, layer=layer, cls=cls, name=name)

    @mcp.tool()
    async def draw_circle(center: Point, radius: Length, layer: str | None = None, cls: str | None = None, name: str | None = None) -> dict:
        """Draw a circle from its center and radius."""
        return await call("draw_circle", center=center, radius=radius, layer=layer, cls=cls, name=name)

    @mcp.tool()
    async def draw_arc(
        center: Point, radius: Length, start_angle: float, sweep_angle: float,
        layer: str | None = None, cls: str | None = None, name: str | None = None,
    ) -> dict:
        """Draw an arc. Degrees; 0 = +X (stage right on a standard plot), counter-clockwise positive."""
        return await call("draw_arc", center=center, radius=radius, start_angle=start_angle, sweep_angle=sweep_angle, layer=layer, cls=cls, name=name)

    @mcp.tool()
    async def draw_polygon(points: list[Point], closed: bool = True, layer: str | None = None, cls: str | None = None, name: str | None = None) -> dict:
        """Draw a closed polygon, or an open one (a polyline of straight segments)."""
        return await call("draw_polygon", points=points, closed=closed, layer=layer, cls=cls, name=name)

    @mcp.tool()
    async def add_text(position: Point, text: str, size_pt: float | None = None, layer: str | None = None, cls: str | None = None) -> dict:
        """Place text with its origin at position. size_pt is the font size in points."""
        return await call("add_text", position=position, text=text, size_pt=size_pt, layer=layer, cls=cls)

    @mcp.tool()
    async def add_dimension(
        start: Point, end: Point, offset: Length = 0, direction: Literal["aligned", "horizontal", "vertical"] = "aligned",
        layer: str | None = None, cls: str | None = None,
    ) -> dict:
        """Add a linear dimension between two points, offset from them by `offset`."""
        return await call("add_dimension", start=start, end=end, offset=offset, direction=direction, layer=layer, cls=cls)

    @mcp.tool()
    async def draw_wall(start: Point, end: Point, thickness: Length | None = None, height: Length | None = None, layer: str | None = None, cls: str | None = None) -> dict:
        """Draw a wall with the document's default wall settings, optionally setting thickness and height."""
        return await call("draw_wall", start=start, end=end, thickness=thickness, height=height, layer=layer, cls=cls)

    @mcp.tool()
    async def list_symbols(contains: str | None = None, limit: int = 500) -> dict:
        """Symbol definitions in this file's resources, with their folders."""
        return await call("list_symbols", contains=contains, limit=limit)

    @mcp.tool()
    async def place_symbol(symbol: str, position: Point, rotation: float = 0, layer: str | None = None, cls: str | None = None) -> dict:
        """Place a symbol from this file's resources (truss, scenery, furniture...)."""
        return await call("place_symbol", symbol=symbol, position=position, rotation=rotation, layer=layer, cls=cls)

    @mcp.tool()
    async def place_lighting_device(
        position: Point, symbol: str, rotation: float = 0, fields: dict[str, str] | None = None,
        layer: str | None = None, cls: str | None = None,
    ) -> dict:
        """Place a Spotlight lighting device using a fixture symbol already in this file
        (check list_symbols). fields sets record values, e.g. {"Channel": "101", "Position": "LX1"}."""
        return await call("place_lighting_device", position=position, symbol=symbol, rotation=rotation, fields=fields, layer=layer, cls=cls)

    # ---- 3D: heights, truss, pipes, clamps, whole rigs (docs/RIG.md) --------------------

    def rig_error(e: Exception):
        return ToolError(str(e))

    @mcp.tool()
    async def set_z(ids: list[str], z: Length) -> dict:
        """Set the height (Z of the insertion point) of symbols and plug-in objects, e.g. z="9'-6\"".
        All or nothing; undo_last puts them back."""
        return await call("set_z", ids=ids, z=z)

    @mcp.tool()
    async def place_truss(
        start: list[float], end: list[float], series_symbol: str = "Truss Box 12in x 12in x 8ft",
        width: float = 12, height: float = 12, roll: float = 0, layer: str | None = None,
    ) -> dict:
        """Place one straight truss section whose CENTERLINE runs start -> end ([x, y, z] in INCHES,
        Z up): level along X or Y, or plumb. The symbol is converted to its Spotlight Straight Truss
        (magnets removed), cut to length, stood up with Hanging Angle 90 when plumb (with the
        half-width pivot corrected). Sloped truss is refused."""
        try:
            pl = rig.truss_placement(start, end, width, height, roll)
        except rig.RigError as e:
            raise rig_error(e) from e
        r = await call("place_truss_section", symbol=series_symbol, insertion=pl["insertion"], rotation=pl["rotation"],
                       length=pl["length"], hanging_angle=pl["hanging_angle"], layer=layer)
        r["orientation"] = pl["orientation"]
        return r

    @mcp.tool()
    async def place_symbol_3d(
        symbol: str, at: list[float], x_axis: list[float], z_axis: list[float],
        y_axis: list[float] | None = None, mirror: bool = False, layer: str | None = None,
    ) -> dict:
        """Place a 3D-only symbol (pipe, clamp...) with its insertion at `at` ([x, y, z] INCHES) and
        its local X and Z pointing along x_axis and z_axis (z is squared up to x). Give y_axis too,
        or mirror=true, for a left-handed (mirrored) placement. Hybrid symbols can only turn about Z."""
        try:
            f = rig.frame_from_axes(x_axis, z_axis, y_axis, mirror)
            rig.v3(at, "at")
        except rig.RigError as e:
            raise rig_error(e) from e
        rot = list(rig.euler_xyz(f.matrix()))
        return await call("place_symbol_3d", symbol=symbol, at=at, rot_xyz=rot, mirror=f.mirrored, layer=layer)

    async def import_from_library(names: list[str]) -> dict:
        """Run the bridge's import_symbols until everything's found or every library file is read."""
        total: dict[str, Any] = {"imported": [], "from": {}, "already_here": [], "not_found": list(names)}
        for _ in range(30):
            r = await call("import_symbols", names=total["not_found"], budget_s=20.0, _timeout=90.0)
            total["imported"] += r["imported"]
            total["from"].update(r["from"])
            total["already_here"] += r["already_here"]
            total["not_found"] = r["not_found"]
            total.update(scan_left=r["scan_left"], library_files=r["library_files"], roots=r["roots"])
            if not r["not_found"] or r["scan_left"] == 0:
                break
        return total

    @mcp.tool()
    async def import_symbols(names: list[str]) -> dict:
        """Import symbols by exact name from Vectorworks' own library files into this file (truss,
        pipes, clamps, stage decks and legs...), so nobody has to find them in the Resource Manager.
        The first search reads the library files (it can take a few minutes); after that it's quick."""
        return await import_from_library(names)

    @mcp.tool()
    async def build_rig(build_list: dict | None = None, design_id: str | None = None, layer: str = "Rig", replace: bool = False, auto_import: bool = True) -> dict:
        """Build a whole truss rig in 3D from a Rig Planner build list (docs/RIG.md, v1), or from an
        approved design on tylerflores.dev by its id ("build design <id>"). Places every truss
        section, corner block, pipe, swivel clamp, stage deck and deck leg on `layer`; reports each
        part, nearest library parts used instead (pipe lengths, clamp angles), parts skipped (skirting,
        guardrails and stairs have no library symbol), and symbols to import first.
        Symbols the file doesn't have yet are imported from Vectorworks' libraries first
        (auto_import=false to only list them).
        A layer that already has objects is refused unless replace=true (which clears it)."""
        if (build_list is None) == (design_id is None):
            raise ToolError("Give either build_list or design_id.")
        if settings.auto_update:  # at most hourly; a failure keeps the map already in force
            await asyncio.to_thread(symbols.refresh, settings.rig_url, config.rig_token(settings), settings.home)
        design = None
        if design_id is not None:
            try:
                design = await asyncio.to_thread(rig.fetch_design, settings.rig_url, config.rig_token(settings), design_id)
            except rig.RigError as e:
                raise rig_error(e) from e
            build_list = design["buildList"]
        problems = rig.validate_build_list(build_list)
        if problems:
            raise ToolError("The build list can't be built: " + "; ".join(problems))
        async def plan_now():
            syms = await call("list_symbols", limit=100000)
            try:
                return rig.plan_build(build_list, [s["name"] for s in syms["symbols"]])
            except rig.RigError as e:
                raise rig_error(e) from e

        plan = await plan_now()
        imported = None
        if plan.missing_symbols and auto_import:
            imported = await import_from_library(plan.missing_symbols)
            if imported["imported"]:
                plan = await plan_now()
        out: dict[str, Any] = {"name": build_list.get("name"), "layer": layer, "skipped": plan.skipped,
                               "substituted": plan.substituted, "warnings": plan.warnings}
        if design is not None:
            out["design"] = {"id": design.get("id", design_id), "name": design.get("name"), "status": design.get("status")}
        if imported is not None:
            out["imported"] = {"symbols": imported["imported"], "from": imported["from"]}
        if plan.missing_symbols:
            if imported is not None:
                out["library_search"] = {"files": imported.get("library_files"), "folders": imported.get("roots"),
                                         "unread_files": imported.get("scan_left")}
            out.update(built=False, missing_symbols=plan.missing_symbols,
                       how_to_fix="Nothing was placed. These weren't found in Vectorworks' library files. Import these symbols from Resource Manager > Vectorworks libraries "
                                  "into this file (truss and rigging hardware; for stages, an assembled deck such as "
                                  "'Stage Deck 4ft x 8ft x 2ft' brings the bare deck in, and each 'Stage Deck Leg' "
                                  "height you need), then run build_rig again.")
            return out
        res = await call("build_rig_parts", steps=plan.steps, layer=layer, replace=replace, _timeout=settings.rig_timeout)
        # Nothing placed (every part skipped) is not a build, so the site isn't told it's built.
        out.update(built=res["failed"] == 0 and res["placed"] > 0, placed=res["placed"], failed=res["failed"], cleared=res["cleared"], parts=res["results"])
        if design_id is not None and out["built"]:
            try:
                await asyncio.to_thread(rig.mark_built, settings.rig_url, config.rig_token(settings), design_id, (design or {}).get("approvedAt"))
                out["marked_built"] = True
            except rig.RigError as e:
                out["marked_built"] = False
                out["mark_built_error"] = "Built fine, but couldn't tell the site: %s" % e
        return out

    # ---- reading & measuring ---------------------------------------------------------

    @mcp.tool()
    async def list_objects(
        layer: str | None = None, cls: str | None = None, selected_only: bool = False,
        object_type: str | None = None, limit: int = 200, include_geometry: bool = False,
    ) -> dict:
        """List objects with bounding box, size, length, area and perimeter.

        object_type: line, rectangle, oval, polygon, polyline, arc, text, group, symbol,
        dimension, wall, plugin. include_geometry adds vertices/endpoints."""
        return await call("list_objects", layer=layer, cls=cls, selected_only=selected_only, object_type=object_type, limit=limit, include_geometry=include_geometry)

    @mcp.tool()
    async def get_selection() -> dict:
        """What the person has selected in Vectorworks right now, with measurements."""
        return await call("list_objects", selected_only=True, limit=500, include_geometry=True)

    @mcp.tool()
    async def get_object(id: str) -> dict:
        """Everything about one object: geometry, measurements, and plug-in/record fields."""
        return await call("get_object", id=id)

    @mcp.tool()
    async def measure_distance(a: str | Point, b: str | Point) -> dict:
        """Distance between two objects (ids) or points. Reports center-to-center (insertion
        point for symbols and fixtures), dx/dy, angle, and the clear gap between bounding boxes."""
        return await call("measure_distance", a=a, b=b)

    # ---- editing ---------------------------------------------------------------------

    @mcp.tool()
    async def move_objects(ids: list[str], dx: Length, dy: Length) -> dict:
        """Move objects by an offset, e.g. dx="2'" dy="-6\"" (all or nothing)."""
        return await call("move_objects", ids=ids, dx=dx, dy=dy)

    @mcp.tool()
    async def rotate_object(id: str, angle: float, center: Point | None = None) -> dict:
        """Rotate by angle degrees (counter-clockwise) about center, or the object's own center."""
        return await call("rotate_object", id=id, angle=angle, center=center)

    @mcp.tool()
    async def duplicate_objects(ids: list[str], dx: Length = 0, dy: Length = 0) -> dict:
        """Copy objects, offset by dx/dy. Returns the copies."""
        return await call("duplicate_objects", ids=ids, dx=dx, dy=dy)

    @mcp.tool()
    async def set_object_properties(id: str, name: str | None = None, cls: str | None = None, layer: str | None = None) -> dict:
        """Rename an object, change its class, or move it to another layer."""
        return await call("set_object_properties", id=id, name=name, cls=cls, layer=layer)

    @mcp.tool()
    async def set_attributes(
        ids: list[str], pen_color: str | None = None, fill_color: str | None = None,
        line_weight_mils: int | None = None, fill: Literal["none", "background", "solid"] | None = None,
    ) -> dict:
        """Pen/fill color (#rrggbb), line weight in mils, fill style. Not reversible with undo_last."""
        return await call("set_attributes", ids=ids, pen_color=pen_color, fill_color=fill_color, line_weight_mils=line_weight_mils, fill=fill)

    @mcp.tool()
    async def group_objects(ids: list[str], name: str | None = None) -> dict:
        """Group objects (same layer) into one group, optionally named."""
        return await call("group_objects", ids=ids, name=name)

    @mcp.tool()
    async def delete_objects(ids: list[str]) -> dict:
        """Delete objects. undo_last can't restore them; Ctrl+Z in Vectorworks can."""
        return await call("delete_objects", ids=ids)

    @mcp.tool()
    async def select_objects(ids: list[str], replace: bool = True, zoom: bool = False) -> dict:
        """Select objects in Vectorworks (to point something out), optionally zooming to them."""
        return await call("select_objects", ids=ids, replace=replace, zoom=zoom)

    @mcp.tool()
    async def zoom_to(ids: list[str] | None = None) -> dict:
        """Fit the Vectorworks view to these objects (or to everything)."""
        return await call("zoom_to", ids=ids)

    @mcp.tool()
    async def undo_last() -> dict:
        """Reverse Claude's most recent change (a whole batch counts as one)."""
        return await call("undo_last")

    @mcp.tool()
    async def batch(steps: list[dict]) -> dict:
        """Run several tool steps in ONE Vectorworks round trip, in order:
        [{"op": "draw_line", "args": {...}}, {"op": "add_text", "args": {...}}].
        Stops at the first failure and says which step; undo_last reverses the batch."""
        return await call("batch", steps=steps)

    # ---- Spotlight -------------------------------------------------------------------

    outer_call = call

    @mcp.tool()
    async def get_lighting_devices(layer: str | None = None, limit: int = 2000) -> dict:
        """Every Spotlight lighting device with all of its fields (channel, unit, position,
        purpose, color, wattage, weight, universe/address...) and its insertion point."""
        return await call("get_lighting_devices", layer=layer, limit=limit)

    async def _read_out_one(path: str | None, max_objects: int, watch: bool = False) -> dict:
        from pathlib import Path

        async def call(op: str, **args: Any) -> Any:  # the watcher's calls don't count as Claude's
            return await outer_call(op, _watch=watch, **args)

        vwx = Path(path).expanduser() if path else None
        opened = False
        if vwx is not None:
            if not vwx.exists():
                raise ToolError("No file at %s." % vwx)
            info = await call("get_document_info")
            if not readout.same_document(info.get("document", ""), vwx):
                try:
                    exe = await asyncio.to_thread(lambda: getattr(trigger, "vectorworks_exe", lambda: None)())
                    await asyncio.to_thread(readout.open_in_vectorworks, vwx, exe)
                    opened = True
                except Exception as e:
                    raise ToolError("Couldn't open %s in Vectorworks: %s. Open it by hand, then call read_out again without a path." % (vwx.name, e)) from e
                waited = asked = 0.0
                while waited < 180.0:  # big files take a while to open
                    await asyncio.sleep(3)
                    box = await asyncio.to_thread(pending_prompt)
                    if box and asked < ASK_WAIT_S:
                        asked += 3
                        continue  # a box is waiting on the designer: their answer, not the clock
                    if box:
                        raise ToolError("Vectorworks is still asking \u201c%s\u201d (buttons: %s) after %d minutes. Answer it, then try again." % (box["text"] or box["title"], ", ".join(box["buttons"]), ASK_WAIT_S // 60))
                    waited += 3
                    try:
                        info = await call("get_document_info", _timeout=10.0)
                    except Exception:
                        continue
                    if readout.same_document(info.get("document", ""), vwx):
                        break
                else:
                    raise ToolError("Vectorworks didn't show %s within 3 minutes. Open it by hand, then call read_out again without a path." % vwx.name)
        data = await call("read_out", max_objects=max_objects, _timeout=max(settings.rig_timeout, 300.0))
        doc_path = Path(data.get("path") or "")
        if vwx is not None:
            dest = readout.target_for(vwx)
        elif doc_path.is_absolute() and doc_path.parent.exists():
            dest = readout.target_for(doc_path)
        else:
            dest = settings.home / "readouts" / (Path(data.get("document") or "drawing").stem + readout.SUFFIX)
        dest.parent.mkdir(parents=True, exist_ok=True)
        stem = dest.name[: -len(readout.SUFFIX)]
        body, parts, trimmed = readout.split(data, stem)

        def put(path, b):
            tmp = path.with_name(path.name + ".tmp")
            tmp.write_bytes(b)
            tmp.replace(path)

        for i, b in enumerate(parts, 1):  # the parts first, so the main file never names a missing one
            put(readout.mesh_part_name(dest, i), b)
        n = len(parts) + 1
        while readout.mesh_part_name(dest, n).exists():  # an older, bigger read-out's leftovers
            with contextlib.suppress(OSError):
                readout.mesh_part_name(dest, n).unlink()
            n += 1
        put(dest, body)
        out = {"saved": str(dest), "bytes": len(body) + sum(len(b) for b in parts), "mesh_parts": len(parts), "shapes_left_out": trimmed, **readout.summary(data)}
        open_name = str(data.get("document") or "")
        if opened and readout.is_converted_copy(open_name, vwx) and hasattr(trigger, "close_copy"):
            # Opening an older file made an unsaved converted copy. Left open, it blocks the next job
            # with a "name and save for backup?" box after 30 minutes. Close it without saving.
            try:
                out["closed_copy"] = await asyncio.to_thread(trigger.close_copy, open_name)
            except Exception as e:
                out["closed_copy"] = False
                out["close_note"] = "Couldn't close the converted copy %s: %s" % (open_name, e)
        return out

    @mcp.tool()
    async def read_out(path: str | None = None, max_objects: int = MAX_OBJECTS) -> dict:
        """Read the whole drawing out to <name>.rigread.json beside the .vwx (inches: layers,
        classes, every plug-in object with all its fields, symbols, shapes), so Rig Studio and
        Claude can work on it with Vectorworks closed; in a Dropbox folder it syncs by itself.
        With `path` the file is opened in Vectorworks first (a full Windows path); without it,
        the open document is read. Under 5 MB: the plainest shapes are left out first, and it
        says how many."""
        return await _read_out_one(path, max_objects)

    @mcp.tool()
    async def read_out_folder(folder: str, only_new: bool = True, limit: int = 10) -> dict:
        """read_out for every .vwx in a folder and below (backups skipped) whose read-out is
        missing or older than the file, up to `limit` files, one at a time. Each file is opened
        in Vectorworks; nothing is saved to the drawings."""
        from pathlib import Path

        root = Path(folder).expanduser()
        if not root.is_dir():
            raise ToolError("No folder at %s." % root)
        todo = [p for p in readout.vwx_files(root) if not only_new or readout.needs_read(p)]
        done, failed = [], []
        for p in todo[: max(1, int(limit))]:
            try:
                done.append(await _read_out_one(str(p), MAX_OBJECTS))
            except ToolError as e:
                failed.append({"file": str(p), "error": str(e)})
        return {"read": done, "failed": failed, "left": max(0, len(todo) - int(limit))}

    async def watch_once(now: float | None = None) -> list[dict]:
        """One look at the watched folders: reads out what's new, if the PC is quiet."""
        since = (now if now is not None else time.monotonic()) - last_claude[0]
        if not readout.quiet(readout.idle_seconds(), since):
            return []
        done = []
        for p in readout.pending(readout.watch_folders())[:3]:
            try:
                async with reading:
                    done.append(await _read_out_one(str(p), MAX_OBJECTS, watch=True))
                _log("read out %s" % p.name)
            except Exception as e:  # a bad file must not stop the watcher
                done.append({"file": str(p), "error": str(e)})
                _log("couldn't read out %s: %s" % (p.name, e))
        return done

    async def watch_loop() -> None:
        STARTUP["watch"] = "; ".join(str(f) for f in readout.watch_folders())
        while True:
            await asyncio.sleep(readout.WATCH_EVERY)
            with contextlib.suppress(Exception):
                await watch_once()

    reading = asyncio.Lock()  # one read-out at a time (requests and the watcher)

    async def requests_once() -> list[dict]:
        """Answer Rig Studio's read-out requests found in Dropbox (see readout.requests)."""
        done = []
        for req, vwx, job in readout.requests(readout.request_folders())[:3]:
            if vwx is None:
                _log("request %s names no drawing beside it; ignored" % req.name)
                with contextlib.suppress(OSError):
                    req.unlink()
                continue
            with contextlib.suppress(OSError):
                req.unlink()  # taken: a second look won't start it twice
            readout.write_status(vwx, job=job, state="reading", message="Your PC has it. Reading the drawing in Vectorworks (a big one takes a few minutes)…")
            try:
                async with reading:
                    work = asyncio.ensure_future(_read_out_one(str(vwx), MAX_OBJECTS))
                    await relay_prompts(work, vwx, job)
                    r = await work
                msg = "Read out on your PC: %s objects, %s layers, %s symbols, %s lighting fixtures." % (
                    r.get("objects", "?"), r.get("layers", "?"), r.get("symbols", "?"), r.get("lighting_devices", 0))
                if r.get("shapes_left_out"):
                    msg += " %s of the plainest shapes were left out to keep it under 5 MB." % r["shapes_left_out"]
                readout.write_status(vwx, job=job, state="done", message=msg, saved=r.get("saved"))
                done.append(r)
                _log("request: read out %s" % vwx.name)
            except Exception as e:
                text = str(e).replace("Error executing tool read_out: ", "")
                readout.write_status(vwx, job=job, state="failed", message=text)
                done.append({"file": str(vwx), "error": text})
                _log("request: couldn't read out %s: %s" % (vwx.name, text))
        return done

    async def relay_prompts(work: "asyncio.Future", vwx, job: str) -> None:
        """While a read-out runs, pass any box Vectorworks waits on (one the connector doesn't know)
        to Rig Studio through the status file, and press what the designer taps there (an answer
        file beside the drawing)."""
        asked = None
        while not work.done():
            await asyncio.wait({work}, timeout=readout.PROMPT_EVERY)
            if work.done():
                break
            p = await asyncio.to_thread(pending_prompt)
            if p and p != asked:
                asked = p
                said = p["text"] or p["title"]
                readout.write_status(vwx, job=job, state="asking", message="Vectorworks is asking: \u201c%s\u201d" % said, prompt=p)
                _log("request: Vectorworks asks %r %s" % (said, p["buttons"]))
            if asked:
                ans = readout.take_answer(vwx, job)
                if ans:
                    try:
                        await asyncio.to_thread(trigger.answer_prompt, ans["button"], bool(ans.get("remember")))
                        readout.write_status(vwx, job=job, state="reading", message="Pressed \u201c%s\u201d. Carrying on reading the drawing…" % ans["button"])
                    except Exception as e:
                        readout.write_status(vwx, job=job, state="asking", message="Couldn't press \u201c%s\u201d (%s). Answer it on the PC." % (ans["button"], e), prompt=asked)
                    asked = None
                elif not p:
                    asked = None  # answered on the PC
                    readout.write_status(vwx, job=job, state="reading", message="Carrying on reading the drawing…")

    async def request_loop() -> None:
        while True:
            await asyncio.sleep(readout.REQUEST_EVERY)
            with contextlib.suppress(Exception):
                await requests_once()

    @mcp.tool()
    async def answer_prompt(button: str, remember: bool = False) -> dict:
        """Answer a box Vectorworks is waiting on (one the connector didn't know): press `button`
        (as its error said). remember=True answers the same box that way by itself from now on.
        Only when the designer chose the answer, or it changes and saves nothing (Skip, Cancel on
        a search, Open Read-Only)."""
        try:
            hit = await asyncio.to_thread(trigger.answer_prompt, button, remember)
        except AttributeError as e:
            raise ToolError("This connector can't answer Vectorworks' boxes here.") from e
        except TriggerError as e:
            raise ToolError(str(e)) from e
        return {"answered": button, "box": hit, "remembered": remember}

    mcp.watch_once = watch_once  # type: ignore[attr-defined]  # for tests
    mcp.requests_once = requests_once  # type: ignore[attr-defined]  # for tests

    @mcp.tool()
    async def set_record_fields(id: str, record: str, values: dict[str, str]) -> dict:
        """Set several record or plug-in fields at once, e.g. record="Lighting Device",
        values={"Channel": "101", "Color": "R60"}. Unknown field names are refused."""
        return await call("set_record_fields", id=id, record=record, values=values)


    # ---- the show: any mix of files ------------------------------------------------------

    @mcp.tool()
    async def survey_drawing() -> dict:
        """What's in this file and where it came from: layers (department, elevation, visibility,
        referenced), classes, design layer viewports (referenced or not), objects by source,
        plug-in types with their real field names, extent and units, plus what to sort out first."""
        return await guarded(show.survey())

    @mcp.tool()
    async def get_show_setup() -> dict:
        """This show's saved settings: datum, sign convention, departments, venue limits."""
        setup, _ = await guarded(show.setup())
        return show.public_setup(setup)

    @mcp.tool()
    async def find_reference_lines() -> dict:
        """Lines, loci and text that look like CL, PL, DSE, setting line or 0,0, to propose a datum."""
        return await call("find_reference_lines")

    @mcp.tool()
    async def set_datum(
        origin: Point, upstage: Literal["up", "down", "left", "right"] = "up",
        cl_name: str | None = None, pl_name: str | None = None,
    ) -> dict:
        """Set the show's datum: the point where CL meets PL (or DSE, or center of the floor), and
        which way upstage points on the page. Positions are then said from it."""
        return await guarded(show.set_datum(origin, upstage, cl_name, pl_name))

    @mcp.tool()
    async def set_departments(mapping: dict[str, str]) -> dict:
        """Say which department a layer or class belongs to, overriding the name-based guess:
        {"layer:Venue DWG": "venue", "class:A-STEEL": "venue"}. Departments: venue, rigging,
        lighting, audio, video, scenic, staging, other. "auto" removes an override."""
        return await guarded(show.set_departments(mapping))

    @mcp.tool()
    async def set_limits(values: dict) -> dict:
        """Venue limits and rigging assumptions for this show, e.g. {"weight_unit": "lb",
        "point_limit": 2000, "beam_limit": 4000, "total_limit": 60000, "high_steel": "60'",
        "beams": {"Beam A": {"height": "62'", "limit": 4000}}, "dynamic_factor": 1.2,
        "truss_weight_per_ft": 8, "cable_allowance_per_ft": 2, "chain_weight_per_ft": 1.1,
        "min_point_spacing": "8'", "default_hoist_wll": "1 ton", "max_bridle_angle": 120}.
        Lengths may be strings with units; weights are in weight_unit."""
        setup, doc = await guarded(show.setup())
        upi = doc["units"]["units_per_inch"]
        from .rigging import parse_length

        def length(v):
            out = parse_length(v, upi)
            if out is None:
                raise ToolError("Can't read the length %r." % v)
            return out

        vals = dict(values)
        for k in ("high_steel", "min_point_spacing", "steel_tolerance"):
            if vals.get(k) is not None:
                vals[k] = length(vals[k])
        if "beams" in vals:
            vals["beams"] = {name: {kk: (length(vv) if kk == "height" else vv) for kk, vv in spec.items()} for name, spec in vals["beams"].items()}
        return await guarded(show.set_limits(**vals))

    @mcp.tool()
    async def where_is(target: str | Point) -> dict:
        """Where an object (id) or point is, the way riggers say it: "12'-0" SL of CL, 30'-0" US of PL"."""
        setup, doc = await guarded(show.setup())
        upi = doc["units"]["units_per_inch"]
        from .rigging import parse_length, stage_position

        if isinstance(target, str):
            o = await call("get_object", id=target)
            (x0, y0), (x1, y1) = o["bbox"]
            p = o.get("location") or [(x0 + x1) / 2, (y0 + y1) / 2]
        else:
            p = [parse_length(target[0], upi), parse_length(target[1], upi)]
        out = stage_position(p, setup.datum(), upi, setup.metric)
        out["datum"] = setup.datum_note
        return out

    @mcp.tool()
    async def get_rigging() -> dict:
        """Raw rigging inventory: hoists, house points, bridles, truss, loads, hanging positions and
        fixtures, with every field Spotlight/Braceworks stores and their height (Z)."""
        return await call("get_rigging", include_fixtures=True)

    @mcp.tool()
    async def rigging_report(save_csv: bool = True) -> dict:
        """The head rigger's paperwork from the drawing as it stands: every point (ID, X/Y from
        the datum, hook height, hoist, capacity, trim, load and where it came from, point load
        incl. hoist and chain, with dynamic factor), dead hang or bridle (legs, tensions, angle when
        steel heights are set), truss loads, beam and roof totals against limits, checks in words
        (danger / warning / info), a mark-out list in walking order, and changes since the last saved
        revision. Writes a CSV next to the show's settings when save_csv."""
        rep = await guarded(show.rigging())
        if save_csv:
            setup, _ = await guarded(show.setup())
            path = show.store.path(setup.document).with_suffix(".points.csv")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(show.csv(rep), encoding="utf-8")
            rep["csv_path"] = str(path)
        return rep

    @mcp.tool()
    async def save_rigging_revision(label: str) -> dict:
        """Remember the point list as it is now (e.g. "Advance v2", "As built Seattle"), so the next
        report lists what moved, appeared, disappeared or changed load."""
        rep = await guarded(show.rigging(save_revision=label))
        return {"saved": label, "points": len(rep["points"])}

    @mcp.tool()
    async def design_bridle(
        span: Length, to_apex_from_a: Length, beam_a_height: Length, beam_b_height: Length,
        apex_height: Length, load: float, weight_unit: Literal["lb", "kg"] = "lb",
    ) -> dict:
        """Two-leg bridle: leg lengths (pin to pin), tensions, horizontal force, vertical share per
        beam, included angle, and suggested steel per leg (longest first, never over length; check
        against what's on the truck). Heights from the floor; the apex must be below both beams."""
        setup, doc = await guarded(show.setup())
        upi = doc["units"]["units_per_inch"]
        from .rigging import format_length, parse_length

        def ln(v, what):
            out = parse_length(v, upi)
            if out is None:
                raise ToolError("Can't read %s %r." % (what, v))
            return out

        S, d1 = ln(span, "span"), ln(to_apex_from_a, "to_apex_from_a")
        ha, hb, apex = ln(beam_a_height, "beam_a_height"), ln(beam_b_height, "beam_b_height"), ln(apex_height, "apex_height")
        r = solve_bridle(S, float(load), d1, ha - apex, hb - ha)
        out = r.as_dict()
        if r.valid:
            for side, leg in (("left", r.left), ("right", r.right)):
                ft = leg.length / upi / 12
                pieces, total, short = leg_parts(ft)
                out[side]["length_text"] = format_length(leg.length, upi, setup.metric)
                out[side]["steel_suggestion_ft"] = pieces
                out[side]["make_up_ft"] = round(short, 3)
        out["checks"] = []
        if r.valid and r.included_angle > setup.limits.max_bridle_angle:
            out["checks"].append("Included angle %.1f° is over %.0f°." % (r.included_angle, setup.limits.max_bridle_angle))
        if r.valid and min(90 - r.left.angle, 90 - r.right.angle) > 60:
            out["checks"].append("A leg is flatter than 30° from horizontal: it carries more than the whole load.")
        out["weight_unit"] = weight_unit
        return out

    @mcp.tool()
    async def bridle_from_legs(leg_a: Length, leg_b: Length, span: Length, rise: Length = 0) -> dict:
        """Where the apex lands for two legs of fixed length (as built from steel), beam B `rise`
        above beam A. Returns distance from beam A and drop below beam A."""
        setup, doc = await guarded(show.setup())
        upi = doc["units"]["units_per_inch"]
        from .rigging import format_length, parse_length

        vals = [parse_length(v, upi) for v in (leg_a, leg_b, span, rise)]
        if any(v is None for v in vals):
            raise ToolError("Write lengths like 15', 17'-6\" or 4.5 m.")
        res = apex_from_legs(*vals)
        if res is None:
            return {"reaches": False, "why": "Those legs can't meet: too short for the span, or one far longer than the other."}
        x, drop = res
        return {"reaches": True, "from_a": x, "drop": drop, "from_a_text": format_length(x, upi, setup.metric), "drop_text": format_length(drop, upi, setup.metric)}

    @mcp.tool()
    async def truss_loads(
        pick_points: list[Length], loads: list[list] = [], weight_per_length: float = 0.0,
        truss_start: Length | None = None, truss_end: Length | None = None,
    ) -> dict:
        """Load at each pick point of a straight truss. Positions along the truss (any length
        strings); loads [[position, weight], ...]; weight_per_length spread over truss_start..end
        (weight per drawing unit; use set_limits for per-foot truss and cable weights in reports).
        Two picks: exact statics (overhangs included; negative = uplift). Three or more: a
        continuous-beam ESTIMATE; verify with Braceworks, load cells or an engineer."""
        setup, doc = await guarded(show.setup())
        upi = doc["units"]["units_per_inch"]
        from .rigging import parse_length

        def ln(v):
            out = parse_length(v, upi)
            if out is None:
                raise ToolError("Can't read the length %r." % v)
            return out

        try:
            r = truss_reactions([ln(p) for p in pick_points], [(ln(p), float(w)) for p, w in loads], float(weight_per_length),
                                None if truss_start is None else ln(truss_start), None if truss_end is None else ln(truss_end))
        except ValueError as e:
            raise ToolError(str(e)) from e
        if r["estimate"]:
            r["warning"] = "Three or more picks: an estimate. Real loads depend on how level the hoists are."
        return r

    @mcp.tool()
    async def check_scale(a: str | Point, b: str | Point, should_be: Length) -> dict:
        """For a PDF or DWG that came in at an unknown scale: measure between two objects/points that
        should be `should_be` apart (a bay, a door, a stage width) and get the factor to fix it
        (then scale_objects)."""
        setup, doc = await guarded(show.setup())
        upi = doc["units"]["units_per_inch"]
        from .rigging import format_length, parse_length

        m = await call("measure_distance", a=a, b=b)
        want = parse_length(should_be, upi)
        if want is None or want <= 0:
            raise ToolError("Write the known length like 8'-0\" or 2400mm.")
        got = m["center_distance"]
        factor = want / got if got else None
        return {"measured": got, "measured_text": format_length(got, upi, setup.metric), "should_be_text": format_length(want, upi, setup.metric),
                "factor": factor, "ok": factor is not None and abs(factor - 1) < 0.002,
                "hint": None if factor is None or abs(factor - 1) < 0.002 else ("Looks like inches vs mm" if abs(factor - 25.4) < 0.5 or abs(factor - 1 / 25.4) < 0.002 else "Looks like feet vs inches" if abs(factor - 12) < 0.1 or abs(factor - 1 / 12) < 0.001 else None)}

    @mcp.tool()
    async def scale_objects(ids: list[str], factor: float, center: Point | None = None) -> dict:
        """Scale 2D objects (a traced PDF, a DWG at the wrong units) by factor about center."""
        return await call("scale_objects", ids=ids, factor=factor, center=center)

    @mcp.tool()
    async def import_dwg(path: str) -> dict:
        """Import a DWG/DXF from this computer without the dialog (Vectorworks' last import settings)
        and report what arrived: new layers/classes, object count, extent (to catch unit mix-ups).
        Afterwards: set_departments for its classes, check_scale on a known dimension."""
        return await call("import_dwg", path=path)

    @mcp.tool()
    async def show_departments(visibility: dict[str, Literal["visible", "gray", "hidden"]]) -> dict:
        """Show, gray or hide whole departments in Vectorworks, e.g. {"venue": "gray", "scenic":
        "hidden"}: every layer of that department changes (classes too, when they decide it)."""
        sv = await guarded(show.survey())
        layers = {l["name"]: visibility[l["dept"]] for l in sv["layers"] if l["dept"] in visibility}
        classes = {c["name"]: visibility[c["dept"]] for c in sv["classes"] if c["objects"] and c["dept"] in visibility and c["dept"] != "other"}
        return await call("set_visibility", layers=layers, classes=classes)

    # ---- looking at it ---------------------------------------------------------------

    @mcp.tool()
    async def snapshot(layer: str | None = None, width_px: int = 900) -> dict:
        """An SVG of the drawing (or one layer) built from geometry. Works without Windows;
        shows outlines, not Vectorworks' rendering. Prefer `screenshot` when available."""
        data = await call("list_objects", layer=layer, limit=5000, include_geometry=True)
        return {"svg": render_svg(data["objects"], width_px=width_px), "object_count": data["count"]}

    @mcp.tool()
    async def screenshot() -> Image:
        """A picture of the Vectorworks window as it is now, to check what you drew."""
        if not isinstance(trigger, HotkeyTrigger):
            raise ToolError("Screenshots need the Windows hotkey setup (VWMCP_TRIGGER=hotkey). Use snapshot instead.")
        try:
            png = trigger.capture_png()
        except TriggerError as e:
            raise ToolError(str(e)) from e
        return Image(data=png, format="png")

    @mcp.tool()
    async def vs_lookup(query: str, limit: int = 20) -> dict:
        """Search the live Vectorworks `vs` API for functions and their signatures (read-only)."""
        return await call("vs_lookup", query=query, limit=limit)

    if settings.trigger == "session":

        @mcp.tool()
        async def end_session() -> dict:
            """Tell the 'MCP Session' dialog in Vectorworks that Claude is done."""
            settings.stop_file.write_text("stop", encoding="utf-8")
            return {"stopping": True}

    if settings.allow_exec:

        @mcp.tool()
        async def run_python(code: str) -> dict:
            """Run Python inside Vectorworks with `vs` available; assign to `result` to return a
            value. Escape hatch for anything the typed tools don't cover. Check signatures with
            vs_lookup first: a wrong vs call opens a blocking Script Errors dialog."""
            return await call("run_python", code=code)

    return mcp


STARTUP: dict = {}


def _log(msg: str) -> None:
    # stdout is the MCP pipe: anything for a person goes to stderr (the Claude app's MCP log).
    print("vwmcp: %s" % msg, file=sys.stderr, flush=True)


def startup(settings: config.Settings, allow_update: bool = True) -> bool:
    """Bring the symbol map and the connector up to date before serving. True when a newer
    connector was installed and should be started in place of this one. Never raises."""
    STARTUP["symbols"] = symbols.load_cached(settings.home)
    if not settings.auto_update:
        STARTUP["update"] = "off (VWMCP_AUTO_UPDATE=0)"
        return False
    token = config.rig_token(settings)
    status = symbols.refresh(settings.rig_url, token, settings.home)
    if status.startswith("refreshed"):
        STARTUP["symbols"] = "site copy, refreshed at start"
    _log("symbol map: %s" % status)
    if not allow_update:
        return False
    try:
        m = update.check(settings.rig_url, token)
        if not m["newer"]:
            STARTUP["update"] = "up to date (%s)" % __version__
            return False
        res = update.install(settings.rig_url, token, m, settings.plugin_dir)
        _log("updated %s -> %s (%d files)" % (res["from"], res["version"], len(res["changed"])))
        return True
    except update.UpdateError as e:
        STARTUP["update"] = "couldn't check for updates: %s" % e
        _log(STARTUP["update"])
    except Exception as e:  # an update must never stop the connector from starting
        STARTUP["update"] = "update failed: %s" % e
        _log(STARTUP["update"])
    return False


def main() -> None:
    settings = config.load()
    if "--no-symbols" in sys.argv:  # a supervised child: its parent already brought things up to date
        STARTUP["symbols"] = symbols.load_cached(settings.home)
        STARTUP["update"] = "checked by the supervisor at start (%s)" % __version__
    elif startup(settings, allow_update="--no-update" not in sys.argv):
        sys.exit(update.relaunch())
    if "--child" not in sys.argv and supervised():
        # The real server runs in a child that is swapped for a fresh one when this package's code
        # changes, so a deploy never needs the Claude app restarted (see supervisor.py).
        from . import supervisor

        sys.exit(supervisor.run([sys.executable, "-m", "vwmcp.server", "--child", "--no-update", "--no-symbols"], Path(__file__).parent, settings.home / BUSY_DIR))
    build_server(settings).run("stdio")


def supervised() -> bool:
    return os.environ.get("VWMCP_SUPERVISE", "1").strip().lower() not in ("0", "false", "no", "off")


if __name__ == "__main__":
    main()
