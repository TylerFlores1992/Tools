"""The MCP server Claude talks to. Each tool queues one job for the bridge inside Vectorworks.

Lengths: a number is in the drawing's own units; a string can carry its unit the way a rigger
writes it: "12'-6\"", "6 1/2\"", "20 ft", "450mm", "1.2 m". Points are [x, y] of either.
Objects are referred to by the `id` (a UUID) returned when they're created or listed.
"""

from __future__ import annotations

from typing import Any, Literal, Union

from mcp.server.mcpserver import Image, MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from . import __version__, config
from .jobs import BridgeError, BridgeTimeout, JobQueue
from .rigging import apex_from_legs, leg_parts, solve_bridle, truss_reactions
from .service import Show
from .svg import render_svg
from .trigger import HotkeyTrigger, TriggerError, make_trigger

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
    mcp = MCPServer("vectorworks", instructions=INSTRUCTIONS, version=__version__)

    async def guarded(coro):
        try:
            return await coro
        except (BridgeError, BridgeTimeout, TriggerError, ValueError) as e:
            raise ToolError(str(e)) from e

    async def call(op: str, **args: Any) -> Any:
        try:
            return await queue.call(op, **{k: v for k, v in args.items() if v is not None})
        except (BridgeError, BridgeTimeout, TriggerError) as e:
            raise ToolError(str(e)) from e  # shown to Claude as a readable tool error

    # ---- document --------------------------------------------------------------------

    @mcp.tool()
    async def ping() -> dict:
        """Check the connection: document, Vectorworks version, units, selection count."""
        return await call("ping")

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

    @mcp.tool()
    async def get_lighting_devices(layer: str | None = None, limit: int = 2000) -> dict:
        """Every Spotlight lighting device with all of its fields (channel, unit, position,
        purpose, color, wattage, weight, universe/address...) and its insertion point."""
        return await call("get_lighting_devices", layer=layer, limit=limit)

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


def main() -> None:
    build_server().run("stdio")


if __name__ == "__main__":
    main()
