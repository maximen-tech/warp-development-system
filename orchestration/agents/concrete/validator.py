from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any
from ..models.router import ModelRouter
from ..logging import log_event

@dataclass
class Validator:
    profile: str = "claude-execution"

    def run(self, summary: Dict[str, Any]) -> Dict[str, Any]:
        router = ModelRouter()
        client = router.get_client(self.profile)
        system = "You are a validator that summarizes validation checks and risks in exactly 3 bullet points."
        prompt = str(summary)
        log_event("agent_request", {"profile": self.profile}, agent="validator", phase="validate")
        result = client.generate(system, prompt) if client else {"text": "- Tools OK\n- Risks low\n- Proceed", "usage": {}}
        log_event("agent_response", {"usage": result.get("usage")}, agent="validator", phase="validate")
        bullets = [s.strip("- ") for s in result.get("text", "").splitlines() if s.strip()]
        return {"bullets": bullets, "raw": result}
