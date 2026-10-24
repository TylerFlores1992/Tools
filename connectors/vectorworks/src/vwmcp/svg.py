"""Turn object geometry from the bridge into an SVG Claude (or a person) can look at."""

from __future__ import annotations

import math
from html import escape
from typing import Any


def _bounds(objects: list[dict[str, Any]]) -> tuple[float, float, float, float]:
    xs: list[float] = []
    ys: list[float] = []
    for o in objects:
        bbox = o.get("bbox")
        if bbox:
            (x1, y1), (x2, y2) = bbox
            xs += [x1, x2]
            ys += [y1, y2]
    if not xs:
        return 0.0, 0.0, 1.0, 1.0
    return min(xs), min(ys), max(xs), max(ys)


def render_svg(objects: list[dict[str, Any]], width_px: int = 900, margin_px: int = 30) -> str:
    x0, y0, x1, y1 = _bounds(objects)
    w = max(x1 - x0, 1e-9)
    h = max(y1 - y0, 1e-9)
    scale = (width_px - 2 * margin_px) / w
    height_px = int(h * scale + 2 * margin_px)

    def tx(x: float) -> float:
        return round((x - x0) * scale + margin_px, 2)

    def ty(y: float) -> float:  # SVG y points down, drawings point up
        return round((y1 - y) * scale + margin_px, 2)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width_px}" height="{height_px}" '
        f'viewBox="0 0 {width_px} {height_px}">',
        f'<rect width="{width_px}" height="{height_px}" fill="white"/>',
        '<g fill="none" stroke="black" stroke-width="1.2">',
    ]

    for o in objects:
        g = o.get("geometry") or {}
        kind = g.get("kind")
        channel = o.get("channel")
        label = escape(
            o.get("name") or (f"ch {channel}" if channel else "") or o.get("symbol") or o.get("plugin") or ""
        )
        title = f"<title>{escape(o.get('type', ''))} {label}</title>"
        if kind == "line":
            (ax, ay), (bx, by) = g["start"], g["end"]
            parts.append(f'<line x1="{tx(ax)}" y1="{ty(ay)}" x2="{tx(bx)}" y2="{ty(by)}">{title}</line>')
        elif kind == "polygon":
            pts = " ".join(f"{tx(x)},{ty(y)}" for x, y in g["points"])
            tag = "polygon" if g.get("closed", True) else "polyline"
            parts.append(f'<{tag} points="{pts}">{title}</{tag}>')
        elif kind == "oval":
            (cx, cy) = g["center"]
            parts.append(
                f'<ellipse cx="{tx(cx)}" cy="{ty(cy)}" rx="{round(g["rx"] * scale, 2)}" '
                f'ry="{round(g["ry"] * scale, 2)}">{title}</ellipse>'
            )
        elif kind == "arc":
            (cx, cy), r = g["center"], g["radius"]
            a0 = math.radians(g["start_angle"])
            a1 = math.radians(g["start_angle"] + g["sweep_angle"])
            sx, sy = cx + r * math.cos(a0), cy + r * math.sin(a0)
            ex, ey = cx + r * math.cos(a1), cy + r * math.sin(a1)
            large = 1 if abs(g["sweep_angle"]) > 180 else 0
            sweep = 0 if g["sweep_angle"] > 0 else 1  # flipped y axis reverses direction
            parts.append(
                f'<path d="M {tx(sx)} {ty(sy)} A {round(r * scale, 2)} {round(r * scale, 2)} 0 {large} {sweep} '
                f'{tx(ex)} {ty(ey)}">{title}</path>'
            )
        elif kind == "text":
            (px, py) = g["position"]
            parts.append(
                f'<text x="{tx(px)}" y="{ty(py)}" font-family="sans-serif" font-size="12" '
                f'fill="black" stroke="none">{escape(g.get("text", ""))}</text>'
            )
        elif o.get("bbox"):  # symbols, plug-in objects, anything else: dashed box + label
            (bx1, by1), (bx2, by2) = o["bbox"]
            parts.append(
                f'<rect x="{tx(bx1)}" y="{ty(by2)}" width="{round((bx2 - bx1) * scale, 2)}" '
                f'height="{round((by2 - by1) * scale, 2)}" stroke="#2266cc" stroke-dasharray="4 3">{title}</rect>'
            )
            parts.append(
                f'<text x="{tx(bx1)}" y="{ty(by2) - 3}" font-family="sans-serif" font-size="10" '
                f'fill="#2266cc" stroke="none">{label}</text>'
            )

    parts += ["</g>", "</svg>"]
    return "\n".join(parts)
