from __future__ import annotations
from typing import Dict, Any, Optional
import os
import requests  # type: ignore
from .base import BaseClient

class GeminiClient(BaseClient):
    def api_key(self) -> Optional[str]:
        return os.environ.get("GOOGLE_API_KEY")

    def generate(self, system: str, prompt: str) -> Dict[str, Any]:
        key = self.api_key()
        if not key:
            return super().generate(system, prompt)
        model = self.spec.model or "gemini-1.5-pro"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [
                {"role": "user", "parts": [{"text": system + "\n\n" + prompt}]}
            ]
        }
        resp = requests.post(url, headers=headers, json=body, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        candidates = data.get("candidates") or []
        text = ""
        if candidates:
            parts = (candidates[0].get("content") or {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts)
        return {"text": text, "usage": data.get("usageMetadata", {}), "provider": "gemini", "model": model}
