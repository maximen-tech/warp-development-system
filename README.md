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
- Read the Ultimate Guide: `GUIDE.md`
- Browse modules in numbered folders
- See `.warp/` for project AI rules and model routing
- Try examples in `examples/`
- Agent-Led mode: start with `/init`, then run `/next` or `/autopilot`

## Repository map
- `.warp/` — WARP.md, agent-config.yml, mcp-servers.yml, models/
- `05_WORKFLOWS/` — slash-commands/, orchestration-templates/, github-actions/
- `06_TEAM_SYNC/` — notebooks/, shared-workflows/, team-spaces.yml
- `examples/` — runnable examples and CI samples

## Next steps
- Fill each module with organization-specific content
- Wire up CI via `05_WORKFLOWS/github-actions`
- Define slash-commands in `05_WORKFLOWS/slash-commands`

## Local orchestration demos
- Start dashboard: `cd tools/dashboard && npm install && npm run start` (http://localhost:3030)
- Run e2e scenarios:
  - PowerShell: `pwsh -File tools/e2e/run_all.ps1`
  - Bash: `bash tools/e2e/run_all.sh`
- Outputs:
  - Live events: `runtime/events.jsonl` (dashboard streams this file)
  - Snapshots: `runtime/scenarios/happy.jsonl`, `runtime/scenarios/escalation.jsonl`, `runtime/scenarios/edge.jsonl`

## Events → UI mapping (user impact)
| Event kind            | UI element                                   | User impact |
|-----------------------|-----------------------------------------------|-------------|
| start                 | header entry                                 | run begun   |
| transition            | row with phase badge                          | state moved |
| agent_request/response| row with agent + usage                        | model call  |
| action_proposed       | row with command + approval badge (auto/manual) | requires attention if manual |
| approval_granted      | timeline entry + approvals queue update       | unlock next step |
| validation_summary    | row with summary bullets count                | ready to review |
| end                   | row with green status                         | run finished |
| error                 | red row with error text                       | investigate; retries may apply |

## Dashboard advanced features
- APIs
  - GET /api/artifacts, GET /api/artifact/plan, GET /api/artifact/download/:name, GET /api/artifact/raw/:name
  - POST /api/events/append (append custom event; e.g., approval_granted)
  - GET /api/console, POST /api/clear-console
  - GET /api/runs/segments, GET /api/runs/export/:idx, POST /api/runs/replay/:idx
  - GET /api/agents, POST /api/agents/validate, PUT /api/agents
  - GET /api/agents/list, POST /api/agents/save, POST /api/agents/validate-json
  - POST /api/agents/item (upsert), DELETE /api/agents/item (delete)
  - GET /api/agents/export?format=json|csv[&names=a,b], POST /api/agents/import {partial,dryRun}
  - GET /api/agents/history, GET /api/agents/diff?name=..., POST /api/agents/rollback-group
  - GET /api/agents/status?window=..., GET /api/agents/logs?agent&limit
  - GET /api/agents/changelog, GET /api/agents/export-one?name&format=json|yaml
  - GET /api/skills, POST /api/skills/save, POST /api/skills/item, DELETE /api/skills/item
  - GET /api/skills/history, POST /api/skills/rollback, GET /api/skills/usage, GET /api/skills/export-one?name&format=yaml|json
  - POST /api/connectors/test { type, config }
  - GET/POST /api/theme, GET/POST /api/approval-mode
  - GET /api/kpi?window=15m|1h|24h&runId=...&format=json|csv
- UI modules
  - Overview (counters + KPI), Timeline, Approvals queue (runId-aware), Artifacts (preview+download+copy, Prism/marked), Analytics (sparkline/heatmap), Console (live tail), Agents (YAML editor+diff+validate), Runs (segments+export+replay)
- Extensibility
  - Append any event via /api/events/append
  - Add new artifacts by writing files into runtime/ (supported: .md, .json, .txt, .diff, .log)
  - Customize layout: drag & drop panels; order persisted in localStorage (key layout:v1)

### Agents Control Panel
- No-code CRUD for agents and skills; live validation and backups
- Bulk operations: delete, duplicate, export/import (JSON/CSV via JSON conversion), diff & rollback
- Approvals UI: required + autonomy (0–3), policy presets (Safe/Balanced/Autonomous) and advanced JSON fallback
- Analytics mini-cards per agent (calls, errors, last activity, avg latency) + logs expand; status window configurable
- Copy/export one agent/skill as JSON/YAML; history and diff before restore; changelog available
- Onboarding wizard on empty state; search/filter by role/health; drag reorder persists

### KPIs and metrics
- Controls: window selector (15m default, 1h, 24h) and run selector (All runs or a specific runId)
- Exposed metrics (server-side aggregated from runtime/events.jsonl):
  - medianTimeToApprovalSec, maxApprovalWaitSec
  - successRate (completed ok / started runs)
  - avgActionsPerRun
  - perAgentPhaseTimeSec (seconds, aggregated by phase×agent) and sparklinePerMin (event density)
- Export: use /api/kpi?window=...&runId=...&format=csv to download a CSV snapshot

## FAQ — Replay / Debug / E2E analyze a run
- Comment rejouer un run ?
  - Page Runs → bouton Replay → crée un nouveau runId et réinjecte les évènements (badge replayOf dans le start).
  - Option: vous pouvez fournir un nouveau goal (prompt) et des constraints via API.
- Comment approuver strictement par run ?
  - Toggle “Strict approvals” (persist server) → l’orchestration ne consomme que les approval_granted avec data.runId = runId.
- Où voir les artefacts et logs ?
  - Artifacts (plan.md, .json/.diff/.log) → preview Prism/marked, Copy/Open.
  - Console panel → stdout/stderr des scénarios.
- Comment exporter/analyser un run ?
  - GET /api/runs/export/:idx (JSONL) puis chargez-le dans vos outils d’analyse.

## FAQ — Understanding your metrics (KPI)
- Fenêtre et filtre: choisissez 15m/1h/24h et un runId (ou tous) pour ajuster les métriques.
- Métriques clés:
  - Median time-to-approval: temps médian entre action_proposed (manual) et approval_granted.
  - Success rate: ratio runs terminés sans erreur / runs démarrés.
  - Avg actions per run: volume moyen d'actions proposées par run.
  - Max approval wait: pic d'attente pour une approbation (bottleneck detection).
  - Time per agent (phase×agent): cumuls de durées par phase/agent (voir heatmap Analytics).
- Export:
  - Bouton Export KPIs (JSON/CSV) dans la page Runs par runId.
  - API: /api/kpi?window=15m&runId=<id>&format=csv pour intégration à des outils externes.
- Bonnes pratiques:
  - En mode strict, envoyez bien runId + actionId dans approval_granted pour des mesures exactes.
  - Pour audits rétrospectifs, utilisez 24h et croisez avec artifacts/logs.
