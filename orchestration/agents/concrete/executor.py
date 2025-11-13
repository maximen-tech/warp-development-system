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
        system = "You translate a high-level plan into shell commands for POSIX and PowerShell. Reply ONLY valid JSON with keys 'posix' and 'windows', each an array of arrays of strings (the shell command)."
        prompt = "\n".join(f"- {s}" for s in plan)
        log_event("agent_request", {"profile": self.profile}, agent="executor", phase="execute")
        result = client.generate(system, prompt) if client else {"text": "{\"posix\":[[\"bash\",\"05_WORKFLOWS/...\"]], \"windows\":[[\"pwsh\",\"-File\",\"05_WORKFLOWS/...\"]]}", "usage": {}}
        log_event("agent_response", {"usage": result.get("usage")}, agent="executor", phase="execute")
        # Best-effort parse JSON, else fallback to deterministic
        import json, re
        raw = result.get("text", "")
        m = re.search(r"\{[\s\S]*\}$", raw.strip())
        try:
            data = json.loads(m.group(0) if m else raw)
        except Exception:
            data = {
                "posix": [["bash", "05_WORKFLOWS/slash-commands/build/build.sh"]],
                "windows": [["pwsh", "-File", "05_WORKFLOWS/slash-commands/build/build.ps1"]],
            }
        return {"actions": data, "raw": {"text": raw, "usage": result.get("usage")}}
