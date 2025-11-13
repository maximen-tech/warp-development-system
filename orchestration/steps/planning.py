from __future__ import annotations
from typing import Any, Dict, List
import os
import subprocess

def _git_top_dirs(root: str) -> List[str]:
    try:
        out = subprocess.check_output(["git", "--no-pager", "ls-files"], cwd=root, text=True)
        paths = [p.strip() for p in out.splitlines() if p.strip()]
        top = sorted({p.split("/")[0] for p in paths if "/" in p})
        return top
    except Exception:
        return []


def plan_step(state: Dict[str, Any]) -> Dict[str, Any]:
    goal = state.get("goal", "")
    root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    top_dirs = _git_top_dirs(root)

    plan = [
        f"Understand goal: {goal}",
        "Index codebase (git ls-files) and extract relevant paths",
        "Propose minimal actions (build/test/plan commands)",
        "Run validation mirroring CI (lint analyzers)"
    ]
    context = {
        "top_dirs": top_dirs,
        "files_hint": ["README.md", ".github/workflows/ci.yml", "WARP.md"],
    }
    # Pattern 11: command history mining seed
    history_entry = {"phase": "planning", "goal": goal, "top_dirs": top_dirs}
    (state.setdefault("history", [])).append(history_entry)
    return {"plan": plan, "context": {**state.get("context", {}), **context}, "status": "planned", "history": state.get("history")}
