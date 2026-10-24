"""The show-level logic Claude's tools and the panel API share: read the drawing through the
queue, add what the person has told us (datum, departments, limits), and work out the rigging.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

from .jobs import JobQueue
from .report import build_report, diff, markout, to_csv
from .rigging import DEPARTMENTS, classify_department, stage_position
from .show import Limits, ShowSetup, ShowStore, validate_department

UPSTAGE = {"up": (0.0, 1.0), "down": (0.0, -1.0), "left": (-1.0, 0.0), "right": (1.0, 0.0)}


class Show:
    def __init__(self, queue: JobQueue, home: Path):
        self.queue = queue
        self.store = ShowStore(home)
        self.home = home

    async def call(self, op: str, **args: Any) -> Any:
        return await self.queue.call(op, **{k: v for k, v in args.items() if v is not None})

    async def setup(self) -> tuple:
        doc = await self.call("get_document_info")
        key = doc.get("path") or doc.get("document") or "untitled"
        return self.store.load(key), doc

    # ---- reading, with departments and rigger positions -----------------------------------

    def enrich(self, objects: list, setup: ShowSetup, upi: float) -> list:
        datum = setup.datum()
        for o in objects:
            dept, how = setup.department_for(o.get("layer", ""), o.get("cls", ""), classify_department)
            o["dept"], o["dept_how"] = dept, how
            (x0, y0), (x1, y1) = o["bbox"]
            p = o.get("location") or [(x0 + x1) / 2, (y0 + y1) / 2]
            o["where"] = stage_position(p, datum, upi, setup.metric)["text"]
        return objects

    async def drawing(self, layer: str | None = None, limit: int = 5000) -> dict:
        setup, doc = await self.setup()
        d = await self.call("list_objects", layer=layer, limit=limit, include_geometry=True)
        self.enrich(d["objects"], setup, doc["units"]["units_per_inch"])
        d["setup"] = self.public_setup(setup)
        d["departments"] = self.department_summary(d["objects"])
        return d

    def department_summary(self, objects: list) -> list:
        counts: dict = {}
        for o in objects:
            counts[o["dept"]] = counts.get(o["dept"], 0) + 1
        return [{"dept": d, "objects": counts[d]} for d in DEPARTMENTS if d in counts]

    def public_setup(self, s: ShowSetup) -> dict:
        from dataclasses import asdict

        return asdict(s)

    async def survey(self) -> dict:
        setup, doc = await self.setup()
        sv = await self.call("survey_drawing")
        for layer in sv["layers"]:
            layer["dept"], layer["dept_how"] = setup.department_for(layer["name"], "", classify_department)
        for c in sv["classes"]:
            key = "class:" + c["name"]
            c["dept"] = setup.departments.get(key) or classify_department("", c["name"])
        situation = []
        if sv["counts"]["referenced"]:
            n = sv["counts"]["referenced"]
            situation.append("%s through referenced files (read-only here; edit them in their own files)." % ("1 object arrives" if n == 1 else "%d objects arrive" % n))
        if sv["counts"]["viewport"]:
            n = sv["counts"]["viewport"]
            situation.append("%s through design layer viewports of this file." % ("1 object shows" if n == 1 else "%d objects show" % n))
        if any(l.get("referenced_file") for l in sv["layers"]):
            situation.append("Some layers are imported by reference: " + ", ".join(l["name"] for l in sv["layers"] if l.get("referenced_file")) + ".")
        if any(re.search(r"^[A-Z]-|\b(0|A-)", c["name"]) for c in sv["classes"] if c["objects"]):
            situation.append("Class names look like DWG layers (e.g. A-STEEL): this file has DWG content. Check its units with check_scale.")
        upi = sv["units"]["units_per_inch"]
        if sv["extent"]:
            (x0, y0), (x1, y1) = sv["extent"]
            size_ft = max(x1 - x0, y1 - y0) / upi / 12
            if size_ft > 2000:
                situation.append("The drawing spans %.0f ft: something is far from the origin or came in at the wrong units." % size_ft)
        if not setup.datum_set:
            situation.append("No datum set yet: set CL and PL/DSE (find_reference_lines can suggest them).")
        sv["situation"] = situation
        sv["setup"] = self.public_setup(setup)
        return sv

    # ---- the show's settings -------------------------------------------------------------

    async def set_datum(self, origin=None, upstage: str = "up", cl_name=None, pl_name=None, note=None) -> dict:
        setup, doc = await self.setup()
        if upstage not in UPSTAGE:
            raise ValueError("upstage is up, down, left or right (on the page)")
        if origin is not None:
            setup.datum_origin = [float(origin[0]), float(origin[1])]
        setup.upstage = list(UPSTAGE[upstage])
        setup.cl_name = cl_name or setup.cl_name
        setup.pl_name = pl_name or setup.pl_name
        setup.datum_note = note or "Set: %s x %s at (%.4g, %.4g), upstage toward the page's %s." % (setup.cl_name, setup.pl_name, setup.datum_origin[0], setup.datum_origin[1], upstage)
        setup.datum_set = True
        self.store.save(setup)
        return self.public_setup(setup)

    async def set_departments(self, mapping: dict) -> dict:
        setup, _ = await self.setup()
        for key, dept in mapping.items():
            if not (key.startswith("layer:") or key.startswith("class:")):
                raise ValueError("Keys are 'layer:<name>' or 'class:<name>'")
            if dept in (None, "", "auto"):
                setup.departments.pop(key, None)
            else:
                setup.departments[key] = validate_department(dept)
        self.store.save(setup)
        return {"departments": setup.departments}

    async def set_limits(self, **values) -> dict:
        setup, _ = await self.setup()
        known = Limits.__dataclass_fields__
        for k, v in values.items():
            if k not in known:
                raise ValueError("Unknown setting %r. Settings: %s" % (k, ", ".join(known)))
            setattr(setup.limits, k, v)
        self.store.save(setup)
        return self.public_setup(setup)["limits"]

    # ---- rigging -----------------------------------------------------------------------------

    async def rigging(self, save_revision: str | None = None) -> dict:
        setup, doc = await self.setup()
        upi = doc["units"]["units_per_inch"]
        rig = await self.call("get_rigging", include_fixtures=True)
        everything = await self.call("list_objects", limit=20000, include_geometry=True)
        objs = self.enrich(everything["objects"], setup, upi)
        venue = [o for o in objs if o["dept"] == "venue"]
        fixtures = [o for o in rig["objects"] if o["kind"] == "fixture"]
        rigging = [o for o in rig["objects"] if o["kind"] != "fixture"]
        rep = build_report(rigging, fixtures, venue, setup, upi)
        rep["markout"] = markout(rep["points"], upi, setup.metric)
        rep["setup"] = self.public_setup(setup)
        rep["document"] = doc.get("document")
        last = self._revisions(setup)
        rep["changes"] = diff(last[-1]["points"], rep["points"], upi) if last else None
        rep["changes_since"] = last[-1]["label"] if last else None
        if save_revision:
            self._save_revision(setup, save_revision, rep)
        return rep

    def _rev_path(self, setup: ShowSetup) -> Path:
        return self.store.path(setup.document).with_suffix(".revisions.json")

    def _revisions(self, setup: ShowSetup) -> list:
        p = self._rev_path(setup)
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []

    def _save_revision(self, setup: ShowSetup, label: str, rep: dict) -> None:
        revs = self._revisions(setup)
        keep = [{k: r[k] for k in ("point", "x", "y", "point_load")} for r in rep["points"]]
        revs.append({"label": label, "at": time.time(), "points": keep})
        p = self._rev_path(setup)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(revs[-20:]), encoding="utf-8")

    def csv(self, rep: dict) -> str:
        return to_csv(rep)

