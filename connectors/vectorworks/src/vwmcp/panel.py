"""A small local HTTP API so a web page (the panel on tylerflores.dev) can see and edit the
open Vectorworks drawing, using the same job queue Claude uses.

    vwmcp-panel                 # prints a pairing link, serves http://127.0.0.1:7377

Safety, in layers:
  - binds 127.0.0.1 only (other machines can't reach it)
  - every /api call except /api/health needs the token in ~/.vwmcp/panel_token
  - browsers may only call it from VWMCP_PANEL_ORIGINS (default: tylerflores.dev + localhost:3000)
  - the Host header must be localhost/127.0.0.1 (blocks DNS-rebinding tricks)
  - only the ops in PANEL_OPS run; run_python never does
"""

from __future__ import annotations

import asyncio
import json
import secrets
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from . import __version__, config
from .jobs import BridgeError, BridgeTimeout, JobQueue
from .trigger import TriggerError, make_trigger

PANEL_OPS = frozenset(
    {
        "ping", "get_document_info", "list_objects", "get_object", "measure_distance",
        "move_objects", "move_object", "rotate_object", "duplicate_objects", "delete_objects",
        "set_object_properties", "select_objects", "clear_selection", "zoom_to", "undo_last",
        "set_record_fields", "get_lighting_devices", "list_symbols",
        "draw_line", "draw_rectangle", "draw_circle", "draw_polygon", "add_text", "add_dimension", "batch",
    }
)
MAX_BODY = 1_000_000


def load_token(settings: config.Settings) -> str:
    settings.home.mkdir(parents=True, exist_ok=True)
    if settings.token_file.exists():
        token = settings.token_file.read_text(encoding="utf-8").strip()
        if len(token) >= 20:
            return token
    token = secrets.token_urlsafe(24)
    settings.token_file.write_text(token, encoding="utf-8")
    try:
        settings.token_file.chmod(0o600)
    except OSError:
        pass
    return token


def pairing_url(settings: config.Settings, token: str, site: str = "https://tylerflores.dev") -> str:
    return f"{site}/private/vectorworks#port={settings.panel_port}&token={token}"


def make_handler(settings: config.Settings, queue: JobQueue, token: str):
    allowed_origins = set(settings.panel_origins)

    class Handler(BaseHTTPRequestHandler):
        server_version = f"vwmcp-panel/{__version__}"

        def log_message(self, fmt: str, *args: Any) -> None:  # quiet by default
            if "-v" in sys.argv:
                super().log_message(fmt, *args)

        # ---- plumbing ----------------------------------------------------------------

        def _origin_ok(self) -> bool:
            origin = self.headers.get("Origin")
            return origin is None or origin.rstrip("/") in allowed_origins

        def _cors(self) -> None:
            origin = self.headers.get("Origin")
            if origin and origin.rstrip("/") in allowed_origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Headers", "authorization, content-type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Access-Control-Max-Age", "600")

        def _send(self, status: int, body: dict) -> None:
            data = json.dumps(body, default=str).encode()
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _guard(self, need_token: bool = True) -> bool:
            port = self.server.server_address[1]  # the real one, even when started on port 0
            if self.headers.get("Host", "") not in {f"127.0.0.1:{port}", f"localhost:{port}"}:
                self._send(HTTPStatus.FORBIDDEN, {"error": "Wrong host."})
                return False
            if not self._origin_ok():
                self._send(HTTPStatus.FORBIDDEN, {"error": "This page isn't allowed to use the panel."})
                return False
            if need_token:
                given = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
                if not secrets.compare_digest(given, token):
                    self._send(HTTPStatus.UNAUTHORIZED, {"error": "Wrong or missing pairing token."})
                    return False
            return True

        def _run(self, op: str, args: dict) -> None:
            if op not in PANEL_OPS:
                self._send(HTTPStatus.FORBIDDEN, {"error": f"The panel can't run '{op}'."})
                return
            if op == "batch" and any(s.get("op") not in PANEL_OPS - {"batch"} for s in args.get("steps", [])):
                self._send(HTTPStatus.FORBIDDEN, {"error": "That batch has a step the panel can't run."})
                return
            try:
                result = asyncio.run(queue.call(op, **args))
                self._send(HTTPStatus.OK, {"ok": True, "result": result})
            except BridgeError as e:
                self._send(HTTPStatus.UNPROCESSABLE_ENTITY, {"ok": False, "error": str(e).split("\n\n")[0]})
            except (BridgeTimeout, TriggerError) as e:
                self._send(HTTPStatus.GATEWAY_TIMEOUT, {"ok": False, "error": str(e)})

        # ---- routes ------------------------------------------------------------------

        def do_OPTIONS(self) -> None:  # CORS preflight
            if not self._guard(need_token=False):
                return
            self.send_response(HTTPStatus.NO_CONTENT)
            self._cors()
            self.end_headers()

        def do_GET(self) -> None:
            url = urlparse(self.path)
            if url.path == "/api/health":
                if self._guard(need_token=False):
                    self._send(HTTPStatus.OK, {"ok": True, "app": "vwmcp-panel", "version": __version__})
                return
            if not self._guard():
                return
            q = {k: v[-1] for k, v in parse_qs(url.query).items()}
            if url.path == "/api/drawing":
                args = {"limit": 5000, "include_geometry": True}
                if q.get("layer"):
                    args["layer"] = q["layer"]
                self._run("list_objects", args)
            elif url.path == "/api/document":
                self._run("get_document_info", {})
            elif url.path == "/api/fixtures":
                self._run("get_lighting_devices", {})
            else:
                self._send(HTTPStatus.NOT_FOUND, {"error": "No such endpoint."})

        def do_POST(self) -> None:
            if not self._guard():
                return
            if urlparse(self.path).path != "/api/op":
                self._send(HTTPStatus.NOT_FOUND, {"error": "No such endpoint."})
                return
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                self._send(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "Request too large."})
                return
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
                op, args = body["op"], body.get("args", {})
                assert isinstance(op, str) and isinstance(args, dict)
            except Exception:
                self._send(HTTPStatus.BAD_REQUEST, {"error": 'Send {"op": "...", "args": {...}}.'})
                return
            self._run(op, args)

    return Handler


def build_panel(settings: config.Settings | None = None) -> tuple[ThreadingHTTPServer, str]:
    settings = settings or config.load()
    token = load_token(settings)
    queue = JobQueue(settings, make_trigger(settings))
    httpd = ThreadingHTTPServer((settings.panel_host, settings.panel_port), make_handler(settings, queue, token))
    httpd.daemon_threads = True
    return httpd, token


def main() -> None:
    settings = config.load()
    httpd, token = build_panel(settings)
    print(f"Vectorworks panel API on http://{settings.panel_host}:{settings.panel_port}")
    print("Open this once to pair the dev page (the token stays in this browser):")
    print(f"  {pairing_url(settings, token)}")
    print("Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
