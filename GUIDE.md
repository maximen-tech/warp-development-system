# Warp Development System — Ultimate Guide (Agent Leads, Human Assists)

This guide explains, end-to-end, how to install, use, and extend the Warp Development System. It is designed for Agent-Led operation: the agent takes the lead; the human is consulted only for critical or ambiguous decisions.

Quick promise
- Minimal questions. The agent suggests best defaults and advances automatically.
- Human confirmation only for critical actions (see CRITICAL_ACTIONS.md).

Use-cases covered
- New project scaffolding with agent-first workflows
- Integrating into an existing repository safely
- Daily dev flows: plan → build → test → review → deploy
- Team setup: notebooks, shared workflows, approvals, metrics

--------------------------------------------------------------------------------

1) Prerequisites
- Git and GitHub account with repo access
- Warp Terminal (recommended)
- Optional tools depending on your stack (docker, kubectl, terraform, etc.)
- Enable GitHub Actions in your repo

Set secrets (as needed)
- Copy `.env.template` to `.env` (never commit `.env`)
- Configure GitHub Actions secrets (Settings → Secrets and variables → Actions)
  - Examples: GITHUB_TOKEN, JIRA_TOKEN, SLACK_WEBHOOK_URL, REGISTRY_TOKEN, AWS_*, KUBECONFIG

--------------------------------------------------------------------------------

2) Installation Options

A. Start a new project from this template
- Click “Use this template” on your repo host OR clone this repo and replace code with your app
- Keep folders: `.warp/`, `05_WORKFLOWS/`, `.github/`, `06_TEAM_SYNC/`, `08_TEMPLATES/`

B. Integrate into an existing project (safe method)
- Copy these folders into your repo root:
  - `.warp/` (project AI rules, models, MCP)
  - `05_WORKFLOWS/` (slash-commands, orchestration, GH Actions examples)
  - `.github/` (workflows, CODEOWNERS, templates) — merge with your existing
  - `06_TEAM_SYNC/` (notebooks, shared workflows) — optional but recommended
  - `.editorconfig`, `.gitattributes`, `.gitignore`, `AGENT_SESSION.md`, `SECURITY.md`
- Keep your app’s code untouched; only add the new directories and workflows
- Open `.warp/agent-config.yml` and verify approval rules match your policies

Minimal verification
- Ensure CI is enabled: `.github/workflows/ci.yml` present
- Run local lint/checks to confirm YAML and scripts validate
  ```bash path=null start=null
  # bash
  yamllint 05_WORKFLOWS
  ```
  ```powershell path=null start=null
  # PowerShell
  # Run markdown/yaml checks via Actions on PRs automatically
  ```

--------------------------------------------------------------------------------

3) Repo Structure (What each part does)
- `.warp/` — central rules for the agent (WARP.md), approvals (agent-config.yml), MCP integrations, model routing
- `05_WORKFLOWS/` — everything automation:
  - `slash-commands/` — /build /test /review /deploy /audit /plan /debug /migrate /document /sync /optimize /index /rules …
  - `orchestration-templates/` — multi-step workflows (build-test-deploy, rollback, etc.)
  - `github-actions/` — CI building blocks (linting, validator)
- `.github/workflows/` — active CI for linting and releases
- `06_TEAM_SYNC/` — notebooks (runbooks), team spaces, shared workflows, knowledge base
- `08_TEMPLATES/` — universal prompt template, 30 categorized prompts, validation checklist, case studies
- `AGENT_SESSION.md` — how to collaborate with the agent efficiently

--------------------------------------------------------------------------------

4) First 10 minutes (Agent-Led Quickstart)
1. Read `.warp/WARP.md` (rules) — note the Agent-Led model
2. Run /init. The agent will ask only what’s necessary and write `project.config.yml`.
   ```bash path=null start=null
   bash 05_WORKFLOWS/slash-commands/build/build.sh
   ```
   ```powershell path=null start=null
   ./05_WORKFLOWS/slash-commands/build/build.ps1
   ```
3. Run tests:
   ```bash path=null start=null
   bash 05_WORKFLOWS/slash-commands/test/test.sh
   ```
   ```powershell path=null start=null
   ./05_WORKFLOWS/slash-commands/test/test.ps1
   ```
4. Review (summarize diffs, run static checks):
   ```bash path=null start=null
   bash 05_WORKFLOWS/slash-commands/review/review.sh
   ```
   ```powershell path=null start=null
   ./05_WORKFLOWS/slash-commands/review/review.ps1
   ```
5. Optional deploy (staging):
   ```bash path=null start=null
   bash 05_WORKFLOWS/slash-commands/deploy/deploy.sh staging
   ```
   ```powershell path=null start=null
   ./05_WORKFLOWS/slash-commands/deploy/deploy.ps1 -Env staging
   ```

--------------------------------------------------------------------------------

5) Daily Dev Flow (Autopilot: /next)
- Run `/next` repeatedly. The agent plans, executes safe steps, and validates. It only stops to ask when needed (critical or ambiguous).
- Under the hood, the flow is Plan → Execute → Validate.
- Plan
  ```bash path=null start=null
  bash 05_WORKFLOWS/slash-commands/plan/plan.sh "Add login with OAuth2"
  ```
  Output: a step-by-step plan you can follow or adapt.

- Execute (small diffs)
  - Edit code or ask the agent for diffs; keep scope tight (file paths + line ranges)
  - Re-run /build and /test rapidly

- Validate
  ```bash path=null start=null
  bash 05_WORKFLOWS/slash-commands/review/review.sh
  ```
  Ensure lint/tests pass before opening a PR.

- Deploy (gated)
  - Staging deploy via slash-command
  - Production deploy in CI with manual approval gate

--------------------------------------------------------------------------------

6) Using the Agent Effectively (Agent-Led)
Prefer `/init` and `/next`. If you must issue a custom request, structure it with the 7 primitives (see `08_TEMPLATES/universal-template.md`):
- [CONTEXTE] Where are we in the repo? Which files?
- [OBJECTIF] One clear sentence
- [SCOPE] What to change; what NOT to touch
- [MODÈLE] Planning vs execution routing (already configured in `.warp/models`)
- [VALIDATION] Lint/tests/dry-run required
- [FORMAT] Diffs-first; minimal edits
- [AUTONOMIE] Exact steps allowed; approval gates

Example prompt
```text path=null start=null
[CONTEXTE] Service API in /src/api; tests in /tests
[OBJECTIF] Add pagination to list endpoint
[SCOPE] Only touch src/api/list.ts and tests/list.test.ts
[MODÈLE] planning: deepseek-planning; execution: claude-execution
[VALIDATION] Run tests and linter; update docs if needed
[FORMAT] Diffs-first, small PR
[AUTONOMIE] May edit files and propose CI changes; no deploy
```

Shortcuts
- `/plan` to decompose tasks
- `/review` to summarize diffs and checks
- `/rules` to display project rules and approvals
- `/index` to refresh indexing (if supported)

--------------------------------------------------------------------------------

7) CI/CD Integration (GitHub Actions)
- Active CI in `.github/workflows/ci.yml` runs on PR and push to main:
  - markdownlint (docs), yamllint (YAML), shellcheck (bash), PSScriptAnalyzer (PowerShell)
- Release workflow `.github/workflows/release.yml` creates releases on tags `v*`
- Orchestration templates in `05_WORKFLOWS/orchestration-templates/` show how to chain commands

Recommended branch policy
- PRs must pass lint/tests; require at least one approval
- Production deploys require manual approval

--------------------------------------------------------------------------------

8) Team Setup (Drive, Notebooks, Shared Workflows)
- Notebooks: see `06_TEAM_SYNC/notebooks/*` (deployment, incident, failover, onboarding)
- Shared workflows: `06_TEAM_SYNC/shared-workflows/*` (deployment, compliance, performance, security)
- Team spaces: configure `06_TEAM_SYNC/team-spaces.yml` and share norms in `knowledge-base.md`

Rollout phases
1) Pilot: one team adopts slash-commands and CI gates
2) Expand: add shared workflows + notebooks; standardize approvals
3) Org-wide: metrics, feedback loops, training (see `10_TEAM_ENABLEMENT/*`)

--------------------------------------------------------------------------------

9) Model Routing & Cost/Latency Optimization
- Edit `.warp/models/*.yml` to tune planning/execution
- Use DeepSeek (planning) + Claude (execution) pattern for cost-optimal results
- See `07_ADVANCED/token-optimization.md` and `latency-management.md` for strategies

Key rules
- Minimal context: attach only relevant paths/diffs
- Low temperature for code edits; cap max-tokens; set stop sequences

--------------------------------------------------------------------------------

10) Security & Approvals
- `.warp/agent-config.yml` sets agent-led defaults: auto-apply safe docs/CI changes; manual for critical globs
- Secrets must never be committed; use placeholders like `{{TOKEN_NAME}}`
- CI runs validators; production-impacting workflows require manual approval
- Critical actions require the exact phrase from `CRITICAL_ACTIONS.md`
- See `07_ADVANCED/auto-execution-safety.md` and `05_WORKFLOWS/github-actions/*`

--------------------------------------------------------------------------------

11) Extending Slash-Commands (your stack)
- Wire `/build` and `/test` to your tools (npm, pytest, gradle, etc.)
  ```bash path=null start=null
  # Example: npm
  sed -i 's/# TODO: build commands/npm ci && npm run build/' 05_WORKFLOWS/slash-commands/build/build.sh
  ```
- Add env vars and credentials via `.env` (local) and GitHub Secrets (CI)
- Add new commands by copying a folder under `slash-commands/` with .sh and .ps1

--------------------------------------------------------------------------------

12) Integration Guides (pick what you need)
- GitHub: `.github/workflows`, `.warp/mcp-servers.yml`
- Jira: `11_INTEGRATIONS/jira-integration.md`
- Slack: `11_INTEGRATIONS/slack-integration.md`
- Kubernetes: `11_INTEGRATIONS/kubernetes-integration.md`
- Docker: `11_INTEGRATIONS/docker-integration.md`
- Terraform: `11_INTEGRATIONS/terraform-integration.md`
- Custom MCP: `11_INTEGRATIONS/custom-mcp-servers.md`

--------------------------------------------------------------------------------

13) Troubleshooting (fast)
- Agent proposes large diffs → narrow [SCOPE], list files and line ranges
- CI fails on lint/tests → run `/review` locally to see exact errors
- Slow loops → see `07_ADVANCED/latency-management.md`; parallelize, cache
- Secrets in logs → use placeholders; rotate if suspected
- Index noise → exclude build artifacts and large binaries

--------------------------------------------------------------------------------

14) Frequently Asked Questions
Q: Can I use this without Warp Terminal?
A: Yes. It works as a normal repo with CLI + GitHub Actions. Warp enhances agent workflows.

Q: Do I have to adopt every module?
A: No. Start with `.warp/`, `05_WORKFLOWS/`, and `.github/` and add more over time.

Q: How do I enforce approvals?
A: `.warp/agent-config.yml`, CODEOWNERS, and branch protections. Production steps use manual gates.

--------------------------------------------------------------------------------

15) Beginner Roadmap (60–90 minutes)
- 0–15m: Read README + this guide; scan `.warp/WARP.md`
- 15–30m: Run `/build`, `/test`, `/review`; open a PR with passing checks
- 30–60m: Use `/plan` to design a small feature; implement with minimal diffs
- 60–90m: Wire your real test/build commands into slash-commands

--------------------------------------------------------------------------------

16) References
- `AGENT_SESSION.md`: how to work with the agent
- `08_TEMPLATES/`: universal template, 30 prompts, validation checklist
- `07_ADVANCED/`: token/latency optimization, safety, metrics
- `06_TEAM_SYNC/`: notebooks, shared workflows, knowledge base

You’re ready. Keep diffs small, approvals tight, and prompts minimal. Automate the rest.
