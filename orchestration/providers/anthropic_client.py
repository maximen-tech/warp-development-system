from __future__ import annotations
from typing import Dict, Any, Optional
import os
import requests  # type: ignore
from .base import BaseClient

class AnthropicClient(BaseClient):
    def api_key(self) -> Optional[str]:
        return os.environ.get("ANTHROPIC_API_KEY")

    def generate(self, system: str, prompt: str) -> Dict[str, Any]:
        key = self.api_key()
        if not key:
            return super().generate(system, prompt)
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": self.spec.model,
            "max_tokens": self.spec.max_tokens,
            "temperature": self.spec.temperature,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }
        resp = requests.post(url, headers=headers, json=body, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        text = "".join(p.get("text", "") for p in data.get("content", []))
        usage = data.get("usage", {})
        return {"text": text, "usage": usage, "provider": "anthropic", "model": self.spec.model}
