from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Optional
import os

try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover
    yaml = None  # type: ignore


@dataclass
class ModelSpec:
    provider: str
    model: str
    temperature: float = 0.2
    max_tokens: int = 2048
    extra: Dict[str, Any] = None  # type: ignore


class ModelRouter:
    """Loads .warp/models/*.yml and resolves a profile name to a provider client.

    Expected keys per profile file (best-effort): provider, model, temperature, max_tokens.
    Unknown keys are stored in extra and passed to clients.
    """

    def __init__(self, root: Optional[str] = None):
        self.root = root or os.path.dirname(os.path.dirname(__file__))
        self._profiles: Dict[str, ModelSpec] = {}
        self._load_profiles()

    def _load_profiles(self) -> None:
        models_dir = os.path.join(os.path.dirname(self.root), ".warp", "models")
        if not os.path.isdir(models_dir):
            return
        for name in os.listdir(models_dir):
            if not name.endswith(".yml"):
                continue
            path = os.path.join(models_dir, name)
            key = os.path.splitext(name)[0]
            try:
                data = yaml.safe_load(open(path, "r", encoding="utf-8").read()) if yaml else {}
            except Exception:
                data = {}
            spec = ModelSpec(
                provider=str((data or {}).get("provider", "anthropic")),
                model=str((data or {}).get("model", "claude-3-5-sonnet-latest")),
                temperature=float((data or {}).get("temperature", 0.2)),
                max_tokens=int((data or {}).get("max_tokens", 2048)),
                extra={k: v for k, v in (data or {}).items() if k not in {"provider", "model", "temperature", "max_tokens"}},
            )
            self._profiles[key] = spec

    def resolve(self, profile: str) -> Optional[ModelSpec]:
        return self._profiles.get(profile)

    def get_client(self, profile: str):
        from ..providers.anthropic_client import AnthropicClient
        from ..providers.openai_client import OpenAIClient
        from ..providers.gemini_client import GeminiClient

        spec = self.resolve(profile)
        if not spec:
            return None
        if spec.provider.lower() in ("anthropic", "claude"):
            return AnthropicClient(spec)
        if spec.provider.lower() in ("openai", "oai"):
            return OpenAIClient(spec)
        if spec.provider.lower() in ("google", "gemini"):
            return GeminiClient(spec)
        # default fallback
        return AnthropicClient(spec)
