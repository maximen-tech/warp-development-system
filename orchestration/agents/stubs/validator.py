from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class ValidatorAgent:
    name: str = "validator"
    model_profile: str = "claude-execution"  # or distinct validation profile

    def summarize(self, checks: Dict[str, bool]) -> Dict[str, Any]:
        score = sum(1 for v in checks.values() if v)
        return {"score": score, "checks": checks}
