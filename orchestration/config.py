from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import os
import re

try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover
    yaml = None  # type: ignore


@dataclass
class AgentConfig:
    default_action: str = "propose"
    auto_apply_globs: List[str] = field(default_factory=list)
    manual_required_globs: List[str] = field(default_factory=list)
    rules: List[Dict[str, Any]] = field(default_factory=list)
    secrets: Dict[str, Any] = field(default_factory=dict)


def _fallback_parse(text: str) -> AgentConfig:
    auto: List[str] = []
    manual: List[str] = []
    section = None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("auto_apply_globs:"):
            section = "auto"
        elif s.startswith("manual_required_globs:"):
            section = "manual"
        elif re.match(r"^-\s+\"?.+\"?$", s):
            val = s.lstrip("- ").strip().strip('"')
            if section == "auto":
                auto.append(val)
            elif section == "manual":
                manual.append(val)
    return AgentConfig(auto_apply_globs=auto, manual_required_globs=manual)


def load_agent_config(root: Optional[str] = None) -> AgentConfig:
    root = root or os.getcwd()
    path = os.path.join(root, ".warp", "agent-config.yml")
    if not os.path.exists(path):
        return AgentConfig()
    try:
        text = open(path, "r", encoding="utf-8").read()
    except Exception:
        return AgentConfig()
    if yaml is not None:
        try:
            data = yaml.safe_load(text) or {}
            approval = data.get("approval", {})
            return AgentConfig(
                default_action=str(approval.get("default", "propose")),
                auto_apply_globs=list(approval.get("auto_apply_globs", []) or []),
                manual_required_globs=list(approval.get("manual_required_globs", []) or []),
                rules=list(approval.get("rules", []) or []),
                secrets=data.get("secrets", {}) or {},
            )
        except Exception:
            # Fall back to regex
            return _fallback_parse(text)
    return _fallback_parse(text)
