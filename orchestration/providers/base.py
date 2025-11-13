from __future__ import annotations
from typing import Dict, Any, Optional
from dataclasses import dataclass
import os
import json

@dataclass
class BaseClient:
    spec: Any

    def api_key(self) -> Optional[str]:
        return None

    def headers(self) -> Dict[str, str]:
        return {}

    def generate(self, system: str, prompt: str) -> Dict[str, Any]:
        """Return dict with text and usage. Subclasses should override.
        Fallback returns mock output when no API key is present.
        """
        return {
            "text": f"[MOCK:{self.__class__.__name__}] {prompt[:120]}...",
            "usage": {"input_tokens": 0, "output_tokens": 0},
            "provider": self.__class__.__name__,
            "model": getattr(self.spec, 'model', 'unknown'),
        }
