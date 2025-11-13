from __future__ import annotations
from typing import Any, Dict, List
import os
from fnmatch import fnmatch
from ..logging import log_event
from ..agents.concrete.executor import Executor


def execute_step(state: Dict[str, Any]) -> Dict[str, Any]:
    root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    cfg = (state.get("config") or {})
    manual_globs = cfg.get("manual_required_globs", [])
    auto_globs = cfg.get("auto_apply_globs", [])

    # Pattern 4: planning/execution separation
    actions: List[Dict[str, Any]] = []
    try:
        agent = Executor()
        res = agent.run(state.get("plan", []))
        model_actions = res.get("actions", {})
        # Normalize into our internal format
        for cmd in (model_actions.get("posix") or []):
            actions.append({"name": "model", "cmd": cmd, "paths": [], "dry_run": True})
    except Exception:
        # fallback deterministic proposals
        actions = [
            {"name": "build(frontend)", "cmd": ["bash", "05_WORKFLOWS/slash-commands/build/build.sh"], "paths": ["tools/dashboard/**"], "dry_run": True},
            {"name": "test", "cmd": ["bash", "05_WORKFLOWS/slash-commands/test/test.sh"], "paths": ["tests/**", "**/*.py"], "dry_run": True},
            {"name": "plan-report", "cmd": ["bash", "05_WORKFLOWS/slash-commands/plan/plan.sh", "Project status"], "paths": ["runtime/plan.md"], "dry_run": True},
        ]
    # Windows alternatives (for display)
    actions_ps = [
        {"name": "build(frontend)", "cmd": ["pwsh", "-File", "05_WORKFLOWS/slash-commands/build/build.ps1"], "paths": ["tools/dashboard/**"], "dry_run": True},
        {"name": "test", "cmd": ["pwsh", "-File", "05_WORKFLOWS/slash-commands/test/test.ps1"], "paths": ["tests/**", "**/*.py"], "dry_run": True},
        {"name": "plan-report", "cmd": ["pwsh", "-File", "05_WORKFLOWS/slash-commands/plan/plan.ps1", "-Task", "Project status"], "paths": ["runtime/plan.md"], "dry_run": True},
    ]

    def _needs_approval(paths: List[str]) -> str:
        # Return "manual", "auto", or "none"
        for p in paths:
            if any(fnmatch(p, g) for g in manual_globs):
                return "manual"
        for p in paths:
            if any(fnmatch(p, g) for g in auto_globs):
                return "auto"
        return "none"

    # Annotate with approval level
    for group in (actions, actions_ps):
        for a in group:
            level = _needs_approval(a.get("paths", []))
            a["approval"] = level
            log_event("action_proposed", {"cmd": a["cmd"], "approval": level, "paths": a.get("paths")}, phase="execute")

    # Optional simulation: add a risky action to demonstrate manual approval gates
    if (state.get("context") or {}).get("simulate_risky"):
        risky = {"name": "infra-apply", "cmd": ["bash", "echo", "apply"], "paths": ["infrastructure/prod/apply.tf"], "dry_run": True}
        level = _needs_approval(risky["paths"])
        risky["approval"] = level
        actions.append(risky)
        log_event("action_proposed", {"cmd": risky["cmd"], "approval": level, "paths": risky.get("paths")}, phase="execute")

    proposed = {"posix": actions, "windows": actions_ps}
    # Pattern 7: Approval gate pyramid (simulation)
    approvals = []
    for a in actions:
        if a.get("approval") == "manual":
            approvals.append({"action": a["name"], "reason": "matches manual_required_globs", "confirmation_phrase": "I APPROVE THIS CRITICAL ACTION"})
    status = "awaiting_approval" if approvals else "actions_proposed"
    return {"actions": proposed, "approvals": approvals, "status": status}
