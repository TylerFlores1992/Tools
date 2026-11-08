"""Where the site key comes from: the MCP config's env, else the Windows user environment.

Seen 2026-11-07: the key was set with SetEnvironmentVariable(..., 'User'), but Claude Desktop
(and the server it starts) didn't have it, so build_rig(design_id=...) said to set it."""

import sys
import types

from vwmcp import config


def fake_winreg(values):
    m = types.ModuleType("winreg")
    m.HKEY_CURRENT_USER = object()

    class Key:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    m.OpenKey = lambda root, sub: Key()

    def query(key, name):
        if name not in values:
            raise FileNotFoundError(name)
        return values[name], 1

    m.QueryValueEx = query
    return m


def test_key_from_the_mcp_env_wins(monkeypatch):
    monkeypatch.setenv("VWMCP_RIG_TOKEN", "from-env")
    monkeypatch.setitem(sys.modules, "winreg", fake_winreg({"VWMCP_RIG_TOKEN": "from-registry"}))
    assert config.rig_token(config.load()) == "from-env"


def test_key_from_the_windows_user_environment_when_the_process_lacks_it(monkeypatch):
    monkeypatch.delenv("VWMCP_RIG_TOKEN", raising=False)
    settings = config.load()
    monkeypatch.setitem(sys.modules, "winreg", fake_winreg({"VWMCP_RIG_TOKEN": " from-registry "}))
    assert config.rig_token(settings) == "from-registry"
    monkeypatch.setitem(sys.modules, "winreg", fake_winreg({}))
    assert config.rig_token(settings) == ""


def test_no_winreg_off_windows(monkeypatch):
    monkeypatch.delenv("VWMCP_RIG_TOKEN", raising=False)
    monkeypatch.setitem(sys.modules, "winreg", None)
    assert config.rig_token(config.load()) == ""
