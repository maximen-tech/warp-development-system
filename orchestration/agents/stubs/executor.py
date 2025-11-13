from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any

"""Stub executor; see orchestration/agents/concrete for routed implementation."""

@dataclass
class ExecutorAgent:
    """Executor agent mapping plans to concrete shell/PowerShell commands.

    Contract
    - Inputs: plan (list[str])
    - Outputs: actions dict {posix: [...], windows: [...]} with dry_run markers
    """
    name: str = "executor"
    model_profile: str = "claude-execution"

    def propose_actions(self, plan: list[str]) -> Dict[str, Any]:
        # Stub: transform plan into actionable commands (dry-run)
        return {
            "posix": [
                {"name": "build", "cmd": ["bash", "05_WORKFLOWS/slash-commands/build/build.sh"], "dry_run": True},
                {"name": "test", "cmd": ["bash", "05_WORKFLOWS/slash-commands/test/test.sh"], "dry_run": True},
            ],
            "windows": [
                {"name": "build", "cmd": ["pwsh", "-File", "05_WORKFLOWS/slash-commands/build/build.ps1"], "dry_run": True},
                {"name": "test", "cmd": ["pwsh", "-File", "05_WORKFLOWS/slash-commands/test/test.ps1"], "dry_run": True},
            ],
        }
