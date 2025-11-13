from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any, List
from ..models.router import ModelRouter
from ..logging import log_event

@dataclass
class Executor:
    profile: str = "claude-execution"

    def run(self, plan: List[str]) -> Dict[str, Any]:
        router = ModelRouter()
        client = router.get_client(self.profile)
        system = "You translate a high-level plan into shell commands for POSIX and PowerShell. Reply as JSON with keys posix, windows."
        prompt = "\n".join(f"- {s}" for s in plan)
        log_event("agent_request", {"profile": self.profile}, agent="executor", phase="execute")
        result = client.generate(system, prompt) if client else {"text": "{\"posix\":[[\"bash\",\"05_WORKFLOWS/...\"]], \"windows\":[[\"pwsh\",\"-File\",\"05_WORKFLOWS/...\"]]}", "usage": {}}
        log_event("agent_response", {"usage": result.get("usage")}, agent="executor", phase="execute")
        # Best-effort parse JSON, else fallback to deterministic
        import json
        try:
            data = json.loads(result.get("text", ""))
        except Exception:
            data = {
                "posix": [["bash", "05_WORKFLOWS/slash-commands/build/build.sh"]],
                "windows": [["pwsh", "-File", "05_WORKFLOWS/slash-commands/build/build.ps1"]],
            }
        return {"actions": data, "raw": result}
