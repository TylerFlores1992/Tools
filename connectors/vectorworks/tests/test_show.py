"""Per-show settings persist per drawing and never mix shows up."""

from vwmcp.rigging import classify_department
from vwmcp.show import Limits, ShowSetup, ShowStore, validate_department

import pytest


def test_settings_round_trip_per_drawing(tmp_path):
    store = ShowStore(tmp_path)
    s = ShowSetup(document=r"C:\Shows\Arena Tour.vwx", datum_origin=[12.0, -6.0], upstage=[0.0, -1.0], pl_name="DSE", datum_set=True)
    s.departments["layer:House"] = "venue"
    s.limits = Limits(weight_unit="lb", point_limit=2000, total_limit=60000)
    store.save(s)
    back = store.load(r"C:\Shows\Arena Tour.vwx")
    assert back.datum_origin == [12.0, -6.0] and back.pl_name == "DSE" and back.limits.point_limit == 2000
    assert store.load(r"C:\Shows\Other Show.vwx").datum_set is False  # a different show starts clean


def test_overrides_beat_guesses():
    s = ShowSetup()
    s.departments["class:House-Truss"] = "venue"
    assert s.department_for("Rigging", "House-Truss", classify_department) == ("venue", "set")
    assert s.department_for("Rigging", "None", classify_department) == ("rigging", "guessed")


def test_departments_are_checked():
    assert validate_department(" Lighting ") == "lighting"
    with pytest.raises(ValueError, match="one of"):
        validate_department("catering")
