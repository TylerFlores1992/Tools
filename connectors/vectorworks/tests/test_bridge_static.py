"""Checks the bridge without running it: things that would only show up inside Vectorworks.

A `vs` call with the wrong number of arguments doesn't raise in Vectorworks; it queues a
modal "Script Errors" dialog that blocks the app. So every call is checked against the
official signatures (vw_plugin/vs_signatures.json, taken from Vectorworks' own reference).
"""

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRIDGE = (ROOT / "vw_plugin" / "vwmcp_bridge.py").read_text(encoding="utf-8")
SIGS = json.loads((ROOT / "vw_plugin" / "vs_signatures.json").read_text(encoding="utf-8"))["signatures"]


def vs_calls(src: str):
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == "vs":
            yield node


def test_parses_as_python_3_9():
    # Vectorworks 2026 embeds Python 3.9.2: no match statements, no newer syntax.
    for name in ("vwmcp_bridge.py", "menu_run_job.py", "menu_session.py"):
        ast.parse((ROOT / "vw_plugin" / name).read_text(encoding="utf-8"), feature_version=(3, 9))


def test_no_runtime_union_types():
    # `str | None` only works at runtime from 3.10. Annotations are fine (postponed), code isn't.
    tree = ast.parse(BRIDGE)
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "isinstance":
            assert not isinstance(node.args[1], ast.BinOp), ast.unparse(node)


def test_every_vs_call_matches_an_official_signature():
    problems = []
    for call in vs_calls(BRIDGE):
        name = call.func.attr
        if name not in SIGS:
            problems.append(f"line {call.lineno}: vs.{name} isn't in the official reference")
            continue
        if any(isinstance(a, ast.Starred) for a in call.args) or call.keywords:
            problems.append(f"line {call.lineno}: vs.{name} called with */keywords; pass positionally")
            continue
        want = len(SIGS[name])
        if len(call.args) != want:
            problems.append(f"line {call.lineno}: vs.{name} takes {want} ({', '.join(SIGS[name])}), got {len(call.args)}")
    assert not problems, "\n".join(problems)


POINT_PARAMS = {"p", "p1", "p2", "center", "startPt", "endPt"}


def test_point_parameters_get_one_tuple_not_two_numbers():
    # Where the reference takes a POINT, pass one (x, y) tuple. A literal number there means
    # the coordinates were spread across two arguments.
    problems = []
    for call in vs_calls(BRIDGE):
        params = SIGS.get(call.func.attr, [])
        for param, arg in zip(params, call.args):
            if param in POINT_PARAMS and isinstance(arg, ast.Constant) and isinstance(arg.value, (int, float)):
                problems.append(f"line {call.lineno}: vs.{call.func.attr} {param}= is a bare number")
    assert not problems, "\n".join(problems)


def test_signature_table_mutation_is_caught(tmp_path):
    # Guard the guard: break one call and make sure the check notices.
    broken = BRIDGE.replace("vs.HMove(h, dx, dy)", "vs.HMove(h, dx)")
    assert broken != BRIDGE
    bad = [c for c in vs_calls(broken) if c.func.attr == "HMove" and len(c.args) != len(SIGS["HMove"])]
    assert bad
