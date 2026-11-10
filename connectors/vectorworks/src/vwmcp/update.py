"""The connector keeps itself current.

tylerflores.dev serves the latest build at /private/vectorworks/vwmcp-win.json ({version, sha256,
size}) and the zip next to it, both behind the same key as the designs (VWMCP_RIG_TOKEN). When the
server starts it checks once; if the site has a newer version it downloads the zip, checks its
SHA-256, unpacks it over this install (an editable `pip install -e` folder), reinstalls if the
dependencies changed, and copies the new bridge into Vectorworks' plug-in folder. The server then
starts the new code in a child process on the same stdin/stdout, so Claude never sees a restart.

Turn it off with VWMCP_AUTO_UPDATE=0. Nothing here ever touches the user's drawings.
"""

from __future__ import annotations

import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

from . import __version__

PREFIX = "vwmcp-win/"
# Never overwritten by an update: the user's own settings and anything outside the package.
KEEP = {".env", "config.local.json"}


class UpdateError(RuntimeError):
    pass


def parse_version(v: str) -> tuple:
    try:
        return tuple(int(x) for x in str(v).strip().lstrip("v").split("."))
    except ValueError:
        raise UpdateError("not a version: %r" % v) from None


def newer(remote: str, local: str = __version__) -> bool:
    return parse_version(remote) > parse_version(local)


def manifest_url(base: str) -> str:
    return base.rstrip("/") + "/private/vectorworks/vwmcp-win.json"


def zip_url(base: str) -> str:
    return base.rstrip("/") + "/private/vectorworks/vwmcp-win.zip"


def _get(url: str, token: str, timeout: float) -> bytes:
    req = urllib.request.Request(url, headers={"Authorization": "Bearer %s" % token})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        hint = " (check VWMCP_RIG_TOKEN)" if e.code in (401, 403) else ""
        raise UpdateError("%s answered %d%s" % (url, e.code, hint)) from None
    except (urllib.error.URLError, OSError) as e:
        raise UpdateError("couldn't reach %s: %s" % (url, getattr(e, "reason", e))) from None


def check(base: str, token: str, timeout: float = 8.0) -> dict:
    """{version, sha256, size} of the site's build, plus `newer` against this one."""
    if not token:
        raise UpdateError("no site key: set VWMCP_RIG_TOKEN to get updates")
    try:
        m = json.loads(_get(manifest_url(base), token, timeout).decode("utf-8"))
    except ValueError:
        raise UpdateError("the site's update manifest isn't JSON") from None
    if not isinstance(m, dict) or not isinstance(m.get("version"), str) or not isinstance(m.get("sha256"), str):
        raise UpdateError("the site's update manifest has no version or sha256")
    m["newer"] = newer(m["version"])
    m["installed"] = __version__
    return m


def install_root() -> Path:
    """The folder this connector was `pip install -e`'d from (holds pyproject.toml and vw_plugin)."""
    root = Path(__file__).resolve().parents[2]
    pp = root / "pyproject.toml"
    if not pp.exists() or 'name = "vwmcp"' not in pp.read_text(encoding="utf-8") or not (root / "vw_plugin").is_dir():
        raise UpdateError("this connector isn't an editable install (pip install -e), so it can't update itself; reinstall it from the zip once")
    return root


def _members(z: zipfile.ZipFile):
    """(relative path, ZipInfo) for each file under vwmcp-win/, refusing anything that would land
    outside the install folder."""
    for info in z.infolist():
        if info.is_dir() or not info.filename.startswith(PREFIX):
            continue
        rel = PurePosixPath(info.filename[len(PREFIX):])
        if rel.is_absolute() or ".." in rel.parts or not rel.parts or ":" in rel.parts[0]:
            raise UpdateError("the update zip has an unsafe path: %s" % info.filename)
        if rel.name in KEEP:
            continue
        yield rel, info


def unpack(data: bytes, root: Path) -> dict:
    """Unpack the zip over `root`. Every file is written to a temporary folder first, then moved
    into place, so a bad zip changes nothing. Returns what changed."""
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise UpdateError("the update isn't a zip file") from None
    members = list(_members(z))
    if not any(str(rel) == "pyproject.toml" for rel, _ in members) or not any(str(rel).endswith("vwmcp_bridge.py") for rel, _ in members):
        raise UpdateError("the update zip isn't a vwmcp build")
    changed: list[str] = []
    old_deps = _deps((root / "pyproject.toml").read_bytes() if (root / "pyproject.toml").exists() else b"")
    new_deps = old_deps
    with tempfile.TemporaryDirectory(prefix="vwmcp-update-", dir=root.parent) as tmp:
        staged = Path(tmp)
        for rel, info in members:
            dest = staged.joinpath(*rel.parts)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(z.read(info))
        for rel, _ in members:
            src = staged.joinpath(*rel.parts)
            dest = root.joinpath(*rel.parts)
            old = dest.read_bytes() if dest.exists() else None
            if old == src.read_bytes():
                continue
            if str(rel) == "pyproject.toml":
                new_deps = _deps(src.read_bytes())
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
            changed.append(rel.as_posix())
    # Only a change in what the connector depends on needs pip. A new version number alone doesn't:
    # reinstalling the running connector on Windows can break halfway (2026-11-09: it left the Claude
    # app's Python unable to import vwmcp), and an editable install picks the new code up anyway.
    return {"changed": changed, "deps": new_deps != old_deps}


def dependency_specs(pyproject: bytes) -> list[str]:
    """The requirement strings a pyproject depends on (for `pip install`), never the project itself."""
    d = _deps(pyproject)
    return list(d[0]) if d else []


def _deps(pyproject: bytes):
    """What a pyproject installs: its dependencies and optional dependencies (None if unreadable)."""
    try:
        import tomllib

        project = tomllib.loads(pyproject.decode("utf-8")).get("project", {})
    except Exception:
        return None
    return (sorted(project.get("dependencies", [])), {k: sorted(v) for k, v in project.get("optional-dependencies", {}).items()})


def install(base: str, token: str, manifest: dict, plugin_dir: Path, timeout: float = 60.0, pip=None) -> dict:
    """Download, verify and unpack the build in `manifest`, refresh dependencies if they changed,
    and copy the new bridge to Vectorworks. Raises UpdateError with nothing changed on a bad file."""
    root = install_root()
    data = _get(zip_url(base), token, timeout)
    digest = hashlib.sha256(data).hexdigest()
    if digest != manifest["sha256"].lower():
        raise UpdateError("the downloaded update doesn't match the site's checksum; nothing was changed")
    out = unpack(data, root)
    if out["deps"]:
        # Install the dependencies themselves, not the connector: reinstalling the connector while it
        # runs replaces vwmcp.exe, which Windows keeps locked, and pip stops halfway with the old copy
        # already removed. The editable install already points at the new code.
        specs = dependency_specs((root / "pyproject.toml").read_bytes())
        run = pip or (lambda: subprocess.run([sys.executable, "-m", "pip", "install", "-q", *specs], capture_output=True, text=True, timeout=600))
        res = run()
        out["pip"] = "ok" if getattr(res, "returncode", 0) == 0 else (getattr(res, "stderr", "") or "failed")[-400:]
    plugin_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / "vw_plugin" / "vwmcp_bridge.py", plugin_dir / "vwmcp_bridge.py")
    out["version"] = manifest["version"]
    out["from"] = __version__
    return out


def relaunch() -> int:
    """Run the freshly installed server in a child process on this process's stdin and stdout
    (so the MCP connection carries straight on), and return its exit code."""
    return subprocess.call([sys.executable, "-m", "vwmcp.server", "--no-update"])
