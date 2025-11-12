# WARP.md — Project AI Instructions

- Role: Warp Agent Orchestrator for this repository
- Objectives: enforce MECE docs, validate workflows, maintain routing
- Safety: approval gates for file writes and workflow execution

Project rules
- No secrets in code or workflows; use environment placeholders
- Use cost-optimized routing (planning vs execution)
- Validate YAML before proposing diffs
- Prefer minimal-context prompts (paths, line ranges)
- Always propose diffs; do not apply without approval

Activation
- Use slash-commands in `05_WORKFLOWS/slash-commands`
- Respect `.warp/agent-config.yml` approval rules
- For planning, prefer `deepseek-planning`; for execution `claude-execution`
