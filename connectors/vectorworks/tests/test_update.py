"""The connector updates itself from the site: checksum, safe unpacking, dependencies, the
bridge, and a start-up that never fails because of an update."""

import hashlib
import io
import json
import zipfile

import pytest

from vwmcp import __version__, config, server, symbols, update


def make_zip(files: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buf.getvalue()


BUILD = {
    "vwmcp-win/pyproject.toml": 'name = "vwmcp"\nversion = "9.9.9"\n',
    "vwmcp-win/vw_plugin/vwmcp_bridge.py": "BRIDGE = 'new'\n",
    "vwmcp-win/src/vwmcp/__init__.py": '__version__ = "9.9.9"\n',
    "vwmcp-win/.env": "SECRET=from-zip\n",
}


@pytest.fixture
def root(tmp_path, monkeypatch):
    r = tmp_path / "vwmcp"
    (r / "vw_plugin").mkdir(parents=True)
    (r / "src" / "vwmcp").mkdir(parents=True)
    (r / "pyproject.toml").write_text('name = "vwmcp"\nversion = "0.0.1"\n')
    (r / "vw_plugin" / "vwmcp_bridge.py").write_text("BRIDGE = 'old'\n")
    (r / ".env").write_text("SECRET=mine\n")
    monkeypatch.setattr(update, "install_root", lambda: r)
    return r


def test_versions_compare_as_numbers():
    assert update.newer("0.5.10", "0.5.9")
    assert not update.newer("0.5.3", "0.5.3")
    assert not update.newer("0.4.9", "0.5.0")
    with pytest.raises(update.UpdateError):
        update.parse_version("latest")


def test_unpack_writes_the_build_and_keeps_the_users_own_files(root):
    out = update.unpack(make_zip(BUILD), root)
    assert (root / "vw_plugin" / "vwmcp_bridge.py").read_text() == "BRIDGE = 'new'\n"
    assert (root / ".env").read_text() == "SECRET=mine\n"
    assert out["deps"] is True and "src/vwmcp/__init__.py" in out["changed"]
    again = update.unpack(make_zip(BUILD), root)
    assert again["changed"] == [] and again["deps"] is False


def test_a_zip_reaching_outside_the_folder_changes_nothing(root):
    bad = dict(BUILD)
    bad["vwmcp-win/../evil.py"] = "x"
    with pytest.raises(update.UpdateError, match="unsafe path"):
        update.unpack(make_zip(bad), root)
    assert (root / "vw_plugin" / "vwmcp_bridge.py").read_text() == "BRIDGE = 'old'\n"
    assert not (root.parent / "evil.py").exists()
    with pytest.raises(update.UpdateError, match="isn't a vwmcp build"):
        update.unpack(make_zip({"vwmcp-win/readme.txt": "hi"}), root)


def test_install_checks_the_checksum_before_touching_anything(root, tmp_path, monkeypatch):
    data = make_zip(BUILD)
    monkeypatch.setattr(update, "_get", lambda url, token, timeout: data)
    plugin = tmp_path / "plugin"
    with pytest.raises(update.UpdateError, match="checksum"):
        update.install("https://x", "k", {"version": "9.9.9", "sha256": "0" * 64}, plugin)
    assert (root / "vw_plugin" / "vwmcp_bridge.py").read_text() == "BRIDGE = 'old'\n"
    assert not plugin.exists()

    ran = []
    res = update.install("https://x", "k", {"version": "9.9.9", "sha256": hashlib.sha256(data).hexdigest()}, plugin, pip=lambda: ran.append(1))
    assert res["version"] == "9.9.9" and res["pip"] == "ok" and ran == [1]
    assert (plugin / "vwmcp_bridge.py").read_text() == "BRIDGE = 'new'\n"


def test_check_reads_the_manifest_and_says_whether_it_is_newer(monkeypatch):
    monkeypatch.setattr(update, "_get", lambda url, token, timeout: json.dumps({"version": "99.0.0", "sha256": "ab"}).encode())
    m = update.check("https://x", "k")
    assert m["newer"] and m["installed"] == __version__
    monkeypatch.setattr(update, "_get", lambda url, token, timeout: b"<html>")
    with pytest.raises(update.UpdateError, match="isn't JSON"):
        update.check("https://x", "k")
    with pytest.raises(update.UpdateError, match="no site key"):
        update.check("https://x", "")


def test_startup_installs_a_newer_build_and_never_fails_on_a_bad_one(tmp_path, monkeypatch):
    monkeypatch.setenv("VWMCP_HOME", str(tmp_path))
    monkeypatch.setenv("VWMCP_RIG_TOKEN", "k")
    monkeypatch.setattr(symbols, "refresh", lambda *a, **k: "site copy is fresh")
    s = config.load()
    monkeypatch.setattr(update, "check", lambda base, token: {"version": "99.0.0", "sha256": "x", "newer": True})
    monkeypatch.setattr(update, "install", lambda base, token, m, plugin: {"from": __version__, "version": "99.0.0", "changed": ["a"]})
    assert server.startup(s) is True
    assert server.startup(s, allow_update=False) is False

    def boom(base, token):
        raise update.UpdateError("couldn't reach the site")

    monkeypatch.setattr(update, "check", boom)
    assert server.startup(s) is False
    assert "couldn't reach the site" in server.STARTUP["update"]

    def crash(base, token, m, plugin):
        raise RuntimeError("disk full")

    monkeypatch.setattr(update, "check", lambda base, token: {"version": "99.0.0", "sha256": "x", "newer": True})
    monkeypatch.setattr(update, "install", crash)
    assert server.startup(s) is False and "disk full" in server.STARTUP["update"]

    monkeypatch.setenv("VWMCP_AUTO_UPDATE", "0")
    assert server.startup(config.load()) is False and server.STARTUP["update"].startswith("off")
