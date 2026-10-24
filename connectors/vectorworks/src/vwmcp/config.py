"""Settings, all read from environment variables so the MCP client config can set them."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    home: Path
    trigger: str  # "hotkey" | "session" | "none"
    hotkey: str  # pywinauto send_keys syntax
    window_title_re: str
    restore_focus: bool
    timeout: float  # seconds to wait for a result
    refire_after: float  # seconds before re-sending the hotkey if the job wasn't picked up
    allow_exec: bool  # expose the raw run_python escape hatch
    idle_ms: int  # how long you must pause in Vectorworks before the hotkey fires
    panel_host: str
    panel_port: int
    panel_origins: tuple[str, ...]  # web pages allowed to drive the panel API

    @property
    def jobs_dir(self) -> Path:
        return self.home / "jobs"

    @property
    def results_dir(self) -> Path:
        return self.home / "results"

    @property
    def plugin_dir(self) -> Path:
        return self.home / "plugin"

    @property
    def stop_file(self) -> Path:
        return self.home / "stop"

    @property
    def token_file(self) -> Path:
        return self.home / "panel_token"


def load() -> Settings:
    home = Path(os.environ.get("VWMCP_HOME", Path.home() / ".vwmcp"))
    return Settings(
        home=home,
        trigger=os.environ.get("VWMCP_TRIGGER", "hotkey").lower(),
        # Ctrl+Shift+Alt+M by default. Assign the same shortcut to "MCP Run Job" in the Workspace Editor.
        hotkey=os.environ.get("VWMCP_HOTKEY", "^+%m"),
        window_title_re=os.environ.get("VWMCP_WINDOW_RE", ".*Vectorworks.*"),
        restore_focus=_flag("VWMCP_RESTORE_FOCUS", True),
        timeout=float(os.environ.get("VWMCP_TIMEOUT", "30")),
        refire_after=float(os.environ.get("VWMCP_REFIRE_AFTER", "3")),
        allow_exec=_flag("VWMCP_ALLOW_EXEC", False),
        idle_ms=int(os.environ.get("VWMCP_IDLE_MS", "600")),
        panel_host=os.environ.get("VWMCP_PANEL_HOST", "127.0.0.1"),
        panel_port=int(os.environ.get("VWMCP_PANEL_PORT", "7377")),
        panel_origins=tuple(
            o.strip().rstrip("/")
            for o in os.environ.get(
                "VWMCP_PANEL_ORIGINS", "https://tylerflores.dev,http://localhost:3000,http://127.0.0.1:3000"
            ).split(",")
            if o.strip()
        ),
    )
