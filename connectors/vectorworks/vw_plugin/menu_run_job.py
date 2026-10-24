# Vectorworks Menu Command: "MCP Run Job"
# Paste this whole script into a new Menu Command (Python) in the Plug-in Manager,
# then give the command a keyboard shortcut (default Ctrl+Shift+Alt+M) in the Workspace Editor.
import importlib
import os
import sys

_plugin = os.path.join(os.environ.get("VWMCP_HOME", os.path.join(os.path.expanduser("~"), ".vwmcp")), "plugin")
if _plugin not in sys.path:
    sys.path.insert(0, _plugin)

import vwmcp_bridge

importlib.reload(vwmcp_bridge)  # pick up bridge updates without restarting Vectorworks
vwmcp_bridge.run_pending()
