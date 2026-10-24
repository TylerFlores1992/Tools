"""Per-show settings: where the datum is, which way is upstage, what each layer/class belongs
to, and the house's limits. Saved per drawing (by its full path) under ~/.vwmcp/shows/, so
opening the same .vwx next week picks them back up. Nothing here touches the drawing itself.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .rigging import DEPARTMENTS, Datum


@dataclass
class Limits:
    """House limits as the venue states them, in the units the person typed (lb or kg)."""

    weight_unit: str = "lb"  # "lb" or "kg"
    point_limit: float | None = None  # max per rigging point
    beam_limit: float | None = None  # max per beam (when the venue rates beams)
    total_limit: float | None = None  # max for the whole roof / grid
    max_bridle_angle: float = 120.0  # included angle at the apex, degrees
    default_hoist_wll: float | None = None  # e.g. 1 ton = 2000 lb
    cable_allowance_per_ft: float = 0.0  # cable weight added along trusses (lb/ft or kg/m)
    truss_weight_per_ft: float = 0.0  # self-weight added along trusses (lb/ft or kg/m)


@dataclass
class ShowSetup:
    document: str = ""
    datum_origin: list = field(default_factory=lambda: [0.0, 0.0])
    upstage: list = field(default_factory=lambda: [0.0, 1.0])
    cl_name: str = "CL"
    pl_name: str = "PL"
    datum_note: str = "Not set: measuring from the drawing's origin, audience at the bottom."
    datum_set: bool = False
    metric: bool = False
    departments: dict = field(default_factory=dict)  # "layer:<name>" / "class:<name>" -> dept
    limits: Limits = field(default_factory=Limits)

    def datum(self) -> Datum:
        return Datum(tuple(self.datum_origin), tuple(self.upstage), self.cl_name, self.pl_name)

    def department_for(self, layer: str, cls: str, guess) -> tuple:
        """(department, how it was decided): a person's override beats the name-based guess."""
        for key in ("class:" + cls, "layer:" + layer):
            if key in self.departments:
                return self.departments[key], "set"
        return guess(layer, cls), "guessed"


def _slug(document: str) -> str:
    base = re.sub(r"[^A-Za-z0-9]+", "-", Path(document).stem or "untitled").strip("-")[:40] or "untitled"
    digest = hashlib.sha1(document.encode("utf-8")).hexdigest()[:10]
    return "%s-%s" % (base, digest)


class ShowStore:
    def __init__(self, home: Path):
        self.dir = home / "shows"

    def path(self, document: str) -> Path:
        return self.dir / ("%s.json" % _slug(document))

    def load(self, document: str) -> ShowSetup:
        p = self.path(document)
        if not p.exists():
            return ShowSetup(document=document)
        raw = json.loads(p.read_text(encoding="utf-8"))
        limits = Limits(**{k: v for k, v in raw.pop("limits", {}).items() if k in Limits.__dataclass_fields__})
        known = {k: v for k, v in raw.items() if k in ShowSetup.__dataclass_fields__}
        return ShowSetup(**{**known, "limits": limits, "document": document})

    def save(self, setup: ShowSetup) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        p = self.path(setup.document)
        tmp = p.with_name(p.name + ".tmp")
        tmp.write_text(json.dumps(asdict(setup), indent=1), encoding="utf-8")
        os.replace(tmp, p)


def validate_department(dept: str) -> str:
    d = dept.strip().lower()
    if d not in DEPARTMENTS:
        raise ValueError("Department must be one of: %s" % ", ".join(DEPARTMENTS))
    return d
