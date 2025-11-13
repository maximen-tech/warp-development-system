from __future__ import annotations
from typing import Any, Dict
import os
import json
import shutil
import subprocess
from ..agents.concrete.validator import Validator
from ..logging import log_event


def _cmd_exists(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def validate_step(state: Dict[str, Any]) -> Dict[str, Any]:
    root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    checks = {
        "markdownlint": _cmd_exists("markdownlint-cli2"),
        "yamllint": _cmd_exists("yamllint"),
        "shellcheck": _cmd_exists("shellcheck"),
        "psscriptanalyzer": _cmd_exists("pwsh"),
    }
    # Pattern 11: record last actions for history/mining
    history = state.get("history", [])
    actions = state.get("actions", {})
    history.append({"phase": "validation", "checks": checks, "actions": actions})
    summary = {"available": checks, "note": "Commands may be unavailable locally; CI will still run them.", "history_len": len(history)}

    # Summarize with concrete validator agent
    try:
        agent = Validator()
        res = agent.run(summary)
        summary["bullets"] = res.get("bullets", [])
        log_event("validation_summary", {"len": len(summary.get("bullets", []))}, phase="validate")
    except Exception:
        pass

    # Write plan.md if a plan exists (Pattern 1 output artifact)
    try:
        runtime = os.path.join(os.path.dirname(os.path.dirname(__file__)), "runtime")
        os.makedirs(runtime, exist_ok=True)
        out = os.path.join(runtime, "plan.md")
        payload = {
            "goal": state.get("goal"),
            "plan": state.get("plan", []),
            "actions": state.get("actions", {}),
            "validation": summary,
        }
        with open(out, "w", encoding="utf-8") as f:
            f.write("# Plan\n\n")
            f.write(json.dumps(payload, indent=2))
    except Exception:
        pass

    return {"validation": summary, "status": "validated"}
