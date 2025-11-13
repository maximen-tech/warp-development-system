#!/usr/bin/env python3
from __future__ import annotations
import sys
import os
import json
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
AGENTS_DIR = os.path.join(ROOT, 'orchestration', 'agents')
SAMPLES_DIR = os.path.join(AGENTS_DIR, 'samples')

FAILS = 0

def fail(msg: str) -> None:
    global FAILS
    print(f"[agents_check] FAIL: {msg}")
    FAILS += 1


def check_docstrings():
for agent_root in ('stubs', 'concrete'):
        for subdir, _, files in os.walk(os.path.join(AGENTS_DIR, agent_root)):
            for f in files:
                if not f.endswith('.py'):
                    continue
                path = os.path.join(subdir, f)
                text = open(path, 'r', encoding='utf-8').read()
                # Require a class-level docstring or module docstring
                if 'class ' in text:
                    m = re.search(r'class\s+\w+\s*:\n\s+"""', text)
                    if not m and not text.strip().startswith('"""'):
                        fail(f"missing docstring: {path}")


def check_samples_exist():
    expected = ['planner.json', 'executor.json', 'validator.json']
    for name in expected:
        p = os.path.join(SAMPLES_DIR, name)
        if not os.path.exists(p):
            fail(f"missing sample: {p}")
        else:
            # basic JSON sanity ignoring comment lines
            raw = open(p, 'r', encoding='utf-8').read()
            payload = '\n'.join(line for line in raw.splitlines() if not line.strip().startswith('#'))
            try:
                json.loads(payload)
            except Exception:
                fail(f"invalid json content in sample: {p}")


def check_agent_config_parser():
    # Ensure loader does not crash
    try:
        sys.path.insert(0, os.path.join(ROOT, 'orchestration'))
        from config import load_agent_config  # type: ignore
        load_agent_config(ROOT)
    except Exception as e:
        fail(f"agent-config parser error: {e}")


def main():
    check_docstrings()
    check_samples_exist()
    check_agent_config_parser()
    if FAILS:
        print(f"[agents_check] FAILURES={FAILS}")
        sys.exit(1)
    print("[agents_check] OK")

if __name__ == '__main__':
    main()
