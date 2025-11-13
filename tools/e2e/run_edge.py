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

# Edge inputs: empty goal, unicode, long context
ctx = {"simulate_risky": False}
result = run_goal(goal='', constraints={"retries": 1}, context=ctx)
result2 = run_goal(goal='测试🚀', constraints={"retries": 1}, context=ctx)

out = os.path.join(scenario_out, 'edge.jsonl')
shutil.copyfile(log_path, out)
print(json.dumps({"status1": result.get('status'), "status2": result2.get('status'), "events": out}))
