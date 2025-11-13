# Orchestration core using LangGraph-style topology (safe scaffolding)
# Patterns: 1 (multi-step), 3 (codebase indexing), 4 (plan/exec separation), 12 (block-level context)

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import os
import json
import shutil
import fnmatch

from .config import load_agent_config
from .logging import log_event

# Optional import of LangGraph; fall back to a simple sequential runner if unavailable
try:  # pragma: no cover
    from langgraph.graph import StateGraph, END  # type: ignore
except Exception:  # pragma: no cover
    StateGraph = None  # type: ignore
    END = "END"  # type: ignore


def _runtime_dir() -> str:
    root = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(root, "runtime")
    os.makedirs(path, exist_ok=True)
    return path


def _write_events(event: Dict[str, Any]) -> None:
    # Back-compat: also push through shared logger
    try:
        log_event(kind="trace", data=event)
    except Exception:
        pass


@dataclass
class OrchestrationState:
    goal: str
    constraints: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)
    plan: List[str] = field(default_factory=list)
    actions: List[Dict[str, Any]] = field(default_factory=list)
    validation: Dict[str, Any] = field(default_factory=dict)
    status: str = "init"


# Steps (pure functions returning partial updates)
from .steps.planning import plan_step  # noqa: E402
from .steps.execution import execute_step  # noqa: E402
from .steps.validation import validate_step  # noqa: E402


class _SimpleRunner:  # minimal shim with invoke() to mirror LangGraph compiled graphs
    def __init__(self, retries: int = 1):
        self._nodes = [plan_step, execute_step, validate_step]
        self._retries = retries

    def invoke(self, state: Dict[str, Any]) -> Dict[str, Any]:
        for fn in self._nodes:
            attempt = 0
            while True:
                try:
                    updates = fn(state)
                    state.update(updates or {})
                    log_event("transition", {"node": fn.__name__}, phase=fn.__name__, status=state.get("status"))
                    break
                except Exception as e:  # guard + retry
                    attempt += 1
                    log_event("error", {"node": fn.__name__}, phase=fn.__name__, status="error", error=str(e))
                    if attempt > self._retries:
                        state["status"] = "failed"
                        return state
        return state


def build_graph(retries: int = 1):
    """Return a compiled LangGraph if available, else a simple sequential runner.

    State is a plain dict to keep runtime dependency-free.
    """
    if StateGraph is not None:  # pragma: no cover
        graph = StateGraph(dict)
        graph.add_node("plan", plan_step)
        graph.add_node("execute", execute_step)
        graph.add_node("validate", validate_step)
        graph.set_entry_point("plan")
        graph.add_edge("plan", "execute")
        graph.add_edge("execute", "validate")
        graph.add_edge("validate", END)
        return graph.compile()
    return _SimpleRunner(retries=retries)


def run_goal(goal: str, constraints: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    cfg = load_agent_config(os.path.dirname(os.path.dirname(__file__)))
    retries = int((constraints or {}).get("retries", 1))
    state: Dict[str, Any] = {
        "goal": goal,
        "constraints": constraints or {},
        "context": context or {},
        "plan": [],
        "actions": [],
        "validation": {},
        "status": "init",
        "config": cfg.__dict__,
        "approvals": [],
        "history": [],
    }
    log_event("start", {"goal": goal, "retries": retries})
    engine = build_graph(retries=retries)
    try:
        result = engine.invoke(state)
    except Exception as e:
        log_event("error", {"stage": "engine"}, status="failed", error=str(e))
        state["status"] = "failed"
        result = state
    log_event("end", {"status": result.get("status")})
    return result
