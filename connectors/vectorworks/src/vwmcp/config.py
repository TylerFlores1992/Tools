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
    process_re: str  # the program that owns the window must match this too
    restore_focus: bool
    timeout: float  # seconds to wait for a result
    refire_after: float  # seconds before re-sending the hotkey if the job wasn't picked up
    allow_exec: bool  # expose the raw run_python escape hatch
    idle_ms: int  # how long you must pause in Vectorworks before the hotkey fires
    panel_host: str
    panel_port: int
    panel_origins: tuple[str, ...]  # web pages allowed to drive the panel API
    rig_url: str = "https://tylerflores.dev"  # where build_rig fetches approved Rig Planner designs
    rig_token: str = ""  # bearer token for the site's /api/rig endpoints
    rig_timeout: float = 180.0  # seconds a whole build_rig job may take inside Vectorworks
    # A blank drawing the hotkey trigger opens when Vectorworks is running with no drawing (its menu
    # commands, "MCP Run Job" among them, are off until one is open). VWMCP_BLANK to move it.
    blank: Path = Path.home() / "Desktop" / "Claude connector.vwx"
    menu: str = "Tools"  # the Vectorworks menu holding the command (VWMCP_MENU)
    menu_item: str = "MCP Run Job"  # the command the menu trigger presses (VWMCP_MENU_ITEM)
    auto_update: bool = True  # check the site for a newer connector and symbol map at start (VWMCP_AUTO_UPDATE=0 to stop)

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


def _user_env(name: str) -> str:
    """A variable from the Windows user environment (HKCU\\Environment). Apps started before it
    was set (Claude Desktop, and the MCP server it launches) don't have it in os.environ."""
    try:
        import winreg  # type: ignore[import-not-found]
    except ImportError:
        return ""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            value, _kind = winreg.QueryValueEx(key, name)
    except OSError:
        return ""
    return str(value).strip()


def rig_token(settings: "Settings") -> str:
    """The site key: from the MCP config's env, else the Windows user environment, read each call
    so setting it doesn't need a restart."""
    return settings.rig_token or os.environ.get("VWMCP_RIG_TOKEN", "").strip() or _user_env("VWMCP_RIG_TOKEN")


def _blank() -> Path:
    """VWMCP_BLANK, else the first 'Claude connector.vwx' on the Desktop or in Documents."""
    if os.environ.get("VWMCP_BLANK"):
        return Path(os.environ["VWMCP_BLANK"]).expanduser()
    for d in ("Desktop", "Documents", "OneDrive/Desktop", "OneDrive/Documents"):
        p = Path.home() / d / "Claude connector.vwx"
        if p.exists():
            return p
    return Path.home() / "Desktop" / "Claude connector.vwx"


def load() -> Settings:
    home = Path(os.environ.get("VWMCP_HOME", Path.home() / ".vwmcp"))
    return Settings(
        home=home,
        # "menu" presses Tools > MCP Run Job through Windows' accessibility interface: no keystrokes,
        # so it works while Windows is locked (measured on the owner's PC, 2026-11-10). It falls back
        # to the shortcut when the PC is unlocked and the menu can't be reached.
        trigger=os.environ.get("VWMCP_TRIGGER", "menu").lower(),
        # Ctrl+Shift+Alt+M by default. Assign the same shortcut to "MCP Run Job" in the Workspace Editor.
        hotkey=os.environ.get("VWMCP_HOTKEY", "^+%m"),
        window_title_re=os.environ.get("VWMCP_WINDOW_RE", ".*Vectorworks.*"),
        process_re=os.environ.get("VWMCP_PROCESS_RE", r"(?i)^vectorworks[^\\/]*\.exe$"),
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
        rig_url=os.environ.get("VWMCP_RIG_URL", "https://tylerflores.dev").strip().rstrip("/"),
        auto_update=os.environ.get("VWMCP_AUTO_UPDATE", "1").strip().lower() not in ("0", "false", "no", "off"),
        rig_token=os.environ.get("VWMCP_RIG_TOKEN", "").strip(),
        rig_timeout=float(os.environ.get("VWMCP_RIG_TIMEOUT", "180")),
        blank=_blank(),
        menu=os.environ.get("VWMCP_MENU", "Tools"),
        menu_item=os.environ.get("VWMCP_MENU_ITEM", "MCP Run Job"),
    )
