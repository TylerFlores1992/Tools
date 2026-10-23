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
"""


def build_server(settings: config.Settings | None = None) -> MCPServer:
    settings = settings or config.load()
    trigger = make_trigger(settings)
    queue = JobQueue(settings, trigger)
    mcp = MCPServer("vectorworks", instructions=INSTRUCTIONS, version=__version__)

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
