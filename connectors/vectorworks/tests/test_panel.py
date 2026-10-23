"""The local panel API: what tylerflores.dev's Vectorworks page talks to."""

import json
import threading
import urllib.error
import urllib.request

import pytest

from vwmcp import config
from vwmcp.panel import build_panel, pairing_url

ORIGIN = "https://tylerflores.dev"


@pytest.fixture
def panel(monkeypatch, fake_vw):
    monkeypatch.setenv("VWMCP_PANEL_PORT", "0")  # any free port
    httpd, token = build_panel(config.load())
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield httpd.server_address[1], token
    httpd.shutdown()


def req(port, path, token=None, origin=ORIGIN, body=None, method=None, host=None):
    headers = {"Host": host or f"127.0.0.1:{port}"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if origin:
        headers["Origin"] = origin
    data = json.dumps(body).encode() if body is not None else None
    if data:
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as res:
            return res.status, dict(res.headers), json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), json.loads(e.read() or b"{}")


def test_health_needs_no_token_but_nothing_else_works_without_one(panel):
    port, token = panel
    assert req(port, "/api/health")[0] == 200
    status, _, body = req(port, "/api/drawing")
    assert status == 401 and "pairing" in body["error"]
    assert req(port, "/api/drawing", token="x" * 32)[0] == 401


def test_the_drawing_comes_back_with_geometry(panel):
    port, token = panel
    status, headers, body = req(port, "/api/drawing", token)
    assert status == 200 and headers["Access-Control-Allow-Origin"] == ORIGIN
    names = {o["name"] for o in body["result"]["objects"]}
    assert {"Deck", "Electric 1"} <= names
    assert all("geometry" in o for o in body["result"]["objects"])


def test_other_websites_are_refused_even_with_the_token(panel):
    port, token = panel
    status, headers, _ = req(port, "/api/drawing", token, origin="https://evil.example")
    assert status == 403 and "Access-Control-Allow-Origin" not in headers


def test_dns_rebinding_hosts_are_refused(panel):
    port, token = panel
    assert req(port, "/api/drawing", token, host=f"attacker.example:{port}")[0] == 403


def test_preflight_allows_private_network_access(panel):
    port, _ = panel
    status, headers, _ = req(port, "/api/op", method="OPTIONS")
    assert status == 204
    assert headers["Access-Control-Allow-Private-Network"] == "true"
    assert "authorization" in headers["Access-Control-Allow-Headers"]


def test_ops_run_and_dangerous_ones_dont(panel):
    port, token = panel
    status, _, body = req(port, "/api/op", token, body={"op": "draw_line", "args": {"start": [0, 0], "end": ["10'", 0]}})
    assert status == 200 and body["result"]["length"] == 120
    status, _, body = req(port, "/api/op", token, body={"op": "run_python", "args": {"code": "1"}})
    assert status == 403 and "can't run" in body["error"]
    status, _, body = req(port, "/api/op", token, body={"op": "batch", "args": {"steps": [{"op": "run_python", "args": {}}]}})
    assert status == 403


def test_vectorworks_errors_come_back_as_words(panel):
    port, token = panel
    status, _, body = req(port, "/api/op", token, body={"op": "get_object", "args": {"id": "{gone}"}})
    assert status == 422 and body["error"].startswith("No object")
    status, _, body = req(port, "/api/op", token, body={"nope": 1})
    assert status == 400


def test_pairing_link_points_at_the_private_page():
    s = config.load()
    assert pairing_url(s, "tok").endswith("/private/vectorworks#port=7377&token=tok")
