# Warp Development System

A production-ready, reusable framework to turn Warp Terminal into the central hub for agentic software development. Progressive learning path, multi-agent workflows, reusable prompts, and team-ready configurations.

- Scope: Terminal-centric orchestration (planning → execution → validation)
- Models: cost-optimal routing (planning: o3/DeepSeek; execution: Claude or equivalent)
- Delivery: 10 modules, workflows, prompts, CI/CD, and team enablement

## Table of Contents
- Quick start
- Repository map
- Modules
  - 01_PHILOSOPHY — Manifesto, Axioms
  - 02_ARCHITECTURE — Layers, Pipeline, Security
  - 03_PRIMITIVES — 7 Primitives, Operators
  - 04_PATTERNS — 12 Patterns + Antipatterns
  - 05_WORKFLOWS — Slash-commands, Orchestration, GitHub Actions
  - 06_TEAM_SYNC — Team Spaces, Notebooks, Shared Workflows
  - 07_ADVANCED — Optimization, Safety, Metrics
  - 08_TEMPLATES — Universal + 30 Prompts
  - 09_PROGRESSION — Learning Path + Checkpoints
  - 10_TEAM_ENABLEMENT — Rollout + Role Guides
  - 11_INTEGRATIONS — GitHub/Jira/Slack/K8s/Docker/Terraform/MCP
- Examples

## Quick start
- Browse modules in numbered folders
- See `.warp/` for project AI rules and model routing
- Try examples in `examples/`

## Repository map
- `.warp/` — WARP.md, agent-config.yml, mcp-servers.yml, models/
- `05_WORKFLOWS/` — slash-commands/, orchestration-templates/, github-actions/
- `06_TEAM_SYNC/` — notebooks/, shared-workflows/, team-spaces.yml
- `examples/` — runnable examples and CI samples

## Next steps
- Fill each module with organization-specific content
- Wire up CI via `05_WORKFLOWS/github-actions`
- Define slash-commands in `05_WORKFLOWS/slash-commands`
