from __future__ import annotations
from typing import Dict, Any, Optional
import os
import requests  # type: ignore
from .base import BaseClient

class OpenAIClient(BaseClient):
    def api_key(self) -> Optional[str]:
        return os.environ.get("OPENAI_API_KEY")

    def generate(self, system: str, prompt: str) -> Dict[str, Any]:
        key = self.api_key()
        if not key:
            return super().generate(system, prompt)
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        body = {
            "model": self.spec.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            "temperature": self.spec.temperature,
            "max_tokens": self.spec.max_tokens,
        }
        resp = requests.post(url, headers=headers, json=body, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        msg = (choice.get("message") or {}).get("content", "")
        usage = data.get("usage", {})
        return {"text": msg, "usage": usage, "provider": "openai", "model": self.spec.model}
