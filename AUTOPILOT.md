# Agent Autopilot — Operating Guide

Principles
- Agent leads; human intervenes only for critical actions or when clarification is required
- Always propose smallest diffs; apply safe changes automatically per policy
- Ask questions with recommended defaults; accept with Enter

Flows
- /init → create `project.config.yml` (stack, build/test commands, deploy target)
- /next → read context + config, then plan→execute→validate the next best step automatically
- /autopilot → chain multiple /next cycles (timeboxed); stop on critical actions for confirmation

Escalation
- Use CRITICAL_ACTIONS.md protocol; require exact phrase before proceeding

Notes
- All steps log outputs and decisions for audit and rollbacks
