# Vectorworks Menu Command: "MCP Session"
# Fallback if the hotkey trigger is flaky. Run it once and Vectorworks keeps answering
# Claude until 15 idle minutes pass, 60 minutes total, or the server writes ~/.vwmcp/stop.
# Vectorworks' own UI is busy while a session runs. Use with VWMCP_TRIGGER=session.
import importlib
import os
import sys

_plugin = os.path.join(os.environ.get("VWMCP_HOME", os.path.join(os.path.expanduser("~"), ".vwmcp")), "plugin")
if _plugin not in sys.path:
    sys.path.insert(0, _plugin)

import vwmcp_bridge

importlib.reload(vwmcp_bridge)
vwmcp_bridge.session(max_minutes=60, idle_minutes=15)
