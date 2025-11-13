from __future__ import annotations
from typing import Any, Dict, Optional
import os
import json
import time
import uuid

EVENTS_FILE = "events.jsonl"


def _runtime_dir() -> str:
    root = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(root, "runtime")
    os.makedirs(path, exist_ok=True)
    return path


def log_event(kind: str, data: Dict[str, Any], agent: Optional[str] = None, phase: Optional[str] = None, status: Optional[str] = None, error: Optional[str] = None) -> None:
    ev = {
        "ts": time.time(),
        "id": str(uuid.uuid4()),
        "kind": kind,
        "agent": agent,
        "phase": phase,
        "status": status,
        "error": error,
        "data": data,
    }
    try:
        events_path = os.path.join(_runtime_dir(), EVENTS_FILE)
        with open(events_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")
    except Exception:
        pass
