from __future__ import annotations
from dataclasses import dataclass
from typing import List

@dataclass
class PlannerAgent:
    name: str = "planner"
    model_profile: str = "deepseek-planning"  # see .warp/models

    def plan(self, goal: str, context_hint: List[str] | None = None) -> List[str]:
        # Stub: in production, call model routed by model_profile
        steps = [
            f"Clarify goal: {goal}",
            "Identify relevant files and constraints",
            "Draft minimal actions (build/test/plan)",
        ]
        return steps
