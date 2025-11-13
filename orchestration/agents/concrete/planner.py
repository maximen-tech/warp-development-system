from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Any
from ..models.router import ModelRouter
from ..logging import log_event

@dataclass
class Planner:
    profile: str = "deepseek-planning"

    def run(self, goal: str, context_hint: List[str]) -> Dict[str, Any]:
        router = ModelRouter()
        client = router.get_client(self.profile)
        system = "You are a planning agent. Output a bullet list of 3-7 steps to achieve the goal."
        prompt = f"Goal: {goal}\nContext: {', '.join(context_hint or [])}"
        log_event("agent_request", {"profile": self.profile, "goal": goal}, agent="planner", phase="plan")
        result = client.generate(system, prompt) if client else {"text": "- Draft plan (fallback)", "usage": {}}
        log_event("agent_response", {"usage": result.get("usage")}, agent="planner", phase="plan")
        # Normalize to list of steps
        text = result.get("text", "")
        steps = [s.strip("- ") for s in text.splitlines() if s.strip()]
        steps = [s for s in steps if s]
        return {"steps": steps, "raw": result}
