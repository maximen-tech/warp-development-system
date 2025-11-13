# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project scope
- This repo is a framework for agentic software development in Warp. It is documentation- and workflow-heavy, with a small Node-based dashboard tool under tools/dashboard and project-scoped agent/routing configuration under .warp/.

Common commands
- Lint (Markdown):
  - Install: npm i -g markdownlint-cli2
  - Run all: markdownlint-cli2 "**/*.md" "!node_modules"
  - Single file: markdownlint-cli2 README.md
- Lint (YAML):
  - Install: pip install yamllint (or: choco install yamllint on Windows)
  - Run all (line-length disabled like CI): yamllint -d '{extends: default, rules: {line-length: disable}}' .
  - Single file: yamllint .github/workflows/ci.yml
- Lint (Shell scripts):
  - Install: shellcheck (Linux: apt-get install -y shellcheck; macOS: brew install shellcheck)
  - Run all: shellcheck -x **/*.sh
  - Single file: shellcheck -x 05_WORKFLOWS/github-actions/release.sh
- Lint (PowerShell scripts):
  - Install: Install-Module PSScriptAnalyzer -Force -Scope CurrentUser
  - Run all: $files = Get-ChildItem -Recurse -Filter *.ps1 | % FullName; if ($files) { Invoke-ScriptAnalyzer -Path $files -Recurse -Severity Warning }
  - Single file: Invoke-ScriptAnalyzer -Path tools/logger/log.ps1 -Severity Warning
- Dashboard (local dev utility):
  - cd tools/dashboard && npm install
  - Start: npm run start (PORT defaults to 3030)
  - Open: http://localhost:3030 (serves runtime/events.jsonl via SSE)
- Tests: No unit test framework is defined in this repository; CI currently runs linters only.

CI parity (reference)
- See .github/workflows/ci.yml for exact steps used in CI (markdownlint-cli2, yamllint, shellcheck, PSScriptAnalyzer). Local commands above mirror CI.

High-level architecture (big picture)
- 5-layer system (02_ARCHITECTURE/system-layers.md):
  - Rendering (terminal/editor)
  - Agentic Pipeline (plan → execute → validate)
  - Context Intelligence (indexing, rules)
  - UX (slash-commands, notebooks)
  - Persistence (Drive, VCS)
- Agentic pipeline (02_ARCHITECTURE/agentic-pipeline.md):
  - Planning: cost-optimized, breadth-first
  - Execution: precise diffs, minimal changes
  - Validation: lint, tests, dry-runs
- Model routing (02_ARCHITECTURE/models-routing.md, .warp/models/*):
  - Plan with deepseek-planning; execute with claude-execution; validation hooks configurable; budget/latency policies live in routing profiles.
- MCP integration (02_ARCHITECTURE/mcp-integration.md, .warp/mcp-servers.yml):
  - Pre-wired servers: GitHub (enabled, env:GITHUB_TOKEN). Jira/Postgres templates are present but disabled. Follow least-privilege and env-based auth.
- Repository roles (README.md):
  - Documentation modules (01–11) define concepts, patterns, and workflows.
  - 05_WORKFLOWS contains orchestration templates (GitHub Actions, etc.) and slash-commands scaffolding.
  - .warp contains project-scoped agent rules, approval policy, model routing, and MCP servers.
  - tools/dashboard is an optional local SSE dashboard reading runtime/events.jsonl.

Agent rules and operating constraints (.warp)
- Interaction model (.warp/WARP.md): Agent leads end-to-end, proposes diffs, applies safe changes automatically per policy; escalate only for critical/destructive actions.
- Approval policy (.warp/agent-config.yml):
  - default: propose; auto-apply: **/*.md, **/.github/**, 05_WORKFLOWS/github-actions/**
  - manual-required: migrations/, infrastructure/, prod/, terraform/, kubernetes/, secrets/, *.sql
  - scripts (*.sh, *.ps1): always propose and require manual approval
  - Secrets: redaction enabled; allow templated env placeholders like {{TOKEN_NAME}}
- Critical actions (CRITICAL_ACTIONS.md):
  - Require exact confirmation phrase: I APPROVE THIS CRITICAL ACTION, with blast-radius summary and safer alternative (dry-run/staging) before proceeding.
- Agents & skills (.warp/agents/*, AGENTS.md):
  - Define atomic skills in skills.yml; compose named agents in agents.yml; tester/reviewer/release_captain included as examples.
  - Use /agent-sync (documented) to validate and print active agents/skills.

Slash-commands and autopilot
- 05_WORKFLOWS/slash-commands/README.md enumerates intended commands (deploy, debug, test, audit, plan, build, review, performance, incident, migrate, document, sync, optimize). Scripts are scaffolds/placeholders unless added.
- AUTOPILOT.md: Recommended flows are /init (capture stack/build/test/deploy), /next (plan→execute→validate next step), and /autopilot (chain multiple /next cycles; pause on critical actions per policy).

Notes for Warp when acting in this repo
- Prefer minimal-context edits (paths, exact line ranges). Always validate YAML before proposing diffs.
- Respect approval boundaries and MCP auth via environment variables.
- For planning tasks, route to deepseek-planning; for code execution, route to claude-execution.

Existing .warp/WARP.md – suggested improvements
- Add a short “Common commands” section (lint/CI parity and dashboard usage) so agents can self-verify changes locally.
- Link explicitly to .github/workflows/ci.yml to keep local and CI checks aligned.
- Clarify Windows vs *nix install notes for yamllint and shellcheck (provide pip/choco and apt/brew variants).
- Mention that unit tests are not configured today to avoid agents searching for non-existent test runners.

Quick local workflows (examples)
- Bash: bash 05_WORKFLOWS/slash-commands/build/build.sh
- Bash: bash 05_WORKFLOWS/slash-commands/test/test.sh [pattern]
- Bash: bash 05_WORKFLOWS/slash-commands/plan/plan.sh [task]
- PowerShell: pwsh -File 05_WORKFLOWS/slash-commands/build/build.ps1
- PowerShell: pwsh -File 05_WORKFLOWS/slash-commands/test/test.ps1 -Pattern all
- PowerShell: pwsh -File 05_WORKFLOWS/slash-commands/plan/plan.ps1 -Task "Project status"

Workflows added
- 05_WORKFLOWS/orchestration-templates/init-warp-dev-system.yml — run CI-parity linting and script analyzers.
