from __future__ import annotations
from dataclasses import dataclass
from typing import List

@dataclass
class PlannerAgent:
    """Planner agent selecting a planning model profile (deepseek-planning).

    Contract
    - Inputs: goal (str), context_hint (list[str])
    - Outputs: ordered list of steps (list[str])
    """
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
