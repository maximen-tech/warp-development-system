from __future__ import annotations
from typing import Any, Dict, List
import os


def execute_step(state: Dict[str, Any]) -> Dict[str, Any]:
    root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    # Pattern 4: planning/execution separation → only propose actions here
    actions: List[Dict[str, Any]] = [
        {"name": "build(frontend)", "cmd": ["bash", "05_WORKFLOWS/slash-commands/build/build.sh"], "dry_run": True},
        {"name": "test", "cmd": ["bash", "05_WORKFLOWS/slash-commands/test/test.sh"], "dry_run": True},
        {"name": "plan-report", "cmd": ["bash", "05_WORKFLOWS/slash-commands/plan/plan.sh", "Project status"], "dry_run": True},
    ]
    # Windows alternatives (for display)
    actions_ps = [
        {"name": "build(frontend)", "cmd": ["pwsh", "-File", "05_WORKFLOWS/slash-commands/build/build.ps1"], "dry_run": True},
        {"name": "test", "cmd": ["pwsh", "-File", "05_WORKFLOWS/slash-commands/test/test.ps1"], "dry_run": True},
        {"name": "plan-report", "cmd": ["pwsh", "-File", "05_WORKFLOWS/slash-commands/plan/plan.ps1", "-Task", "Project status"], "dry_run": True},
    ]
    proposed = {"posix": actions, "windows": actions_ps}
    return {"actions": proposed, "status": "actions_proposed"}
