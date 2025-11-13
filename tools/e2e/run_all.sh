#!/usr/bin/env bash
set -euo pipefail
# Happy path
python3 tools/e2e/run_happy.py || python tools/e2e/run_happy.py
# Escalation + error
python3 tools/e2e/run_escalation.py || python tools/e2e/run_escalation.py
# Edge cases
python3 tools/e2e/run_edge.py || python tools/e2e/run_edge.py
