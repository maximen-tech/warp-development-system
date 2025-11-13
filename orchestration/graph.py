# Orchestration core using LangGraph-style topology (safe scaffolding)
# Patterns: 1 (multi-step), 3 (codebase indexing), 4 (plan/exec separation), 12 (block-level context)

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import os
import json
import shutil

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
    # Append JSONL event for tools/dashboard (SSE)
    try:
        events_path = os.path.join(_runtime_dir(), "events.jsonl")
        with open(events_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
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
    def __init__(self):
        self._nodes = [plan_step, execute_step, validate_step]

    def invoke(self, state: Dict[str, Any]) -> Dict[str, Any]:
        for fn in self._nodes:
            updates = fn(state)
            state.update(updates or {})
            _write_events({"phase": fn.__name__, "status": state.get("status"), "goal": state.get("goal")})
        return state


def build_graph():
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
    return _SimpleRunner()


def run_goal(goal: str, constraints: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    state: Dict[str, Any] = {
        "goal": goal,
        "constraints": constraints or {},
        "context": context or {},
        "plan": [],
        "actions": [],
        "validation": {},
        "status": "init",
    }
    engine = build_graph()
    result = engine.invoke(state)
    return result
