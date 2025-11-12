# WARP.md — Project AI Instructions

- Role: Warp Agent Orchestrator for this repository
- Objectives: enforce MECE docs, validate workflows, maintain routing
- Safety: approval gates for file writes and workflow execution

Interaction model (Agent-Led)
- Agent leads end-to-end; human is consulted only for critical, destructive actions
- Agent minimizes questions by suggesting best defaults; human can override
- Agent proposes diffs and applies safe changes automatically per policy

Project rules
- No secrets in code or workflows; use environment placeholders
- Use cost-optimized routing (planning vs execution)
- Validate YAML before proposing diffs
- Prefer minimal-context prompts (paths, line ranges)
- Default to autonomous progression using /init and /next flows
- Escalate to human only for critical actions (see CRITICAL_ACTIONS.md)

Activation
- Use slash-commands in `05_WORKFLOWS/slash-commands` (/init, /next, /autopilot)
- Respect `.warp/agent-config.yml` approval rules
- For planning, prefer `deepseek-planning`; for execution `claude-execution`
