"""Copy the bridge into ~/.vwmcp/plugin and print the two menu-command scripts to paste
into Vectorworks' Plug-in Manager."""

from __future__ import annotations

import shutil
from pathlib import Path

from . import config


def _plugin_source() -> Path:
    here = Path(__file__).resolve().parent
    for candidate in (here / "vw_plugin", here.parent.parent / "vw_plugin"):
        if (candidate / "vwmcp_bridge.py").exists():
            return candidate
    raise FileNotFoundError("Couldn't find vw_plugin/vwmcp_bridge.py next to the package.")


def main() -> None:
    settings = config.load()
    src = _plugin_source()
    settings.plugin_dir.mkdir(parents=True, exist_ok=True)
    for name in ("vwmcp_bridge.py",):
        shutil.copy2(src / name, settings.plugin_dir / name)

    print(f"Bridge copied to {settings.plugin_dir}\n")
    for script in ("menu_run_job.py", "menu_session.py"):
        print(f"===== {script} " + "=" * (60 - len(script)))
        print((src / script).read_text(encoding="utf-8"))
    print("Paste each script into its own Menu Command in Tools > Plug-ins > Plug-in Manager.")
    print("See README.md, section 'Vectorworks setup'.")


if __name__ == "__main__":
    main()
