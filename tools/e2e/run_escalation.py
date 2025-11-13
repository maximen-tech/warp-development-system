#!/usr/bin/env python3
from __future__ import annotations
import os, json, shutil
from orchestration.graph import run_goal

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
runtime = os.path.join(ROOT, 'runtime')
log_path = os.path.join(runtime, 'events.jsonl')
scenario_out = os.path.join(runtime, 'scenarios')
os.makedirs(scenario_out, exist_ok=True)

# Clear previous events
open(log_path, 'w', encoding='utf-8').close()

result = run_goal(goal='escalation+error demo', constraints={"retries": 1, "simulate_error": True}, context={"simulate_risky": True})

out = os.path.join(scenario_out, 'escalation.jsonl')
shutil.copyfile(log_path, out)
print(json.dumps({"status": result.get('status'), "events": out}))
