# Changelog

All notable changes to this project will be documented in this file.

## [Wave 1.3] - 2025-01-13
### Added - Hyperspeed Collaboration Features 🚀
- **Notifications Center**: Bell icon with real-time SSE stream, inline approve/dismiss actions, sound toggle
- **Marketplace UI**: Search/filter, star ratings, one-click install with dependency resolution, preview modals
- **Real-time Collaboration**: WebSocket presence indicators, activity feed, multi-user tracking, user avatars
- **Performance**: All features <500ms latency, mobile responsive, auto-reconnect on connection loss
- **Integration**: Features work together - marketplace installs trigger notifications and activity updates
- **APIs**: 15+ new endpoints for notifications, marketplace, and collaboration
- **Lines of code**: 2,874 lines added across backend + frontend (652 + 1,272 + 950)

## v1.0.0-rc1 - Orchestration and Dashboard (2025-11-13)
Highlights
- Multi-agent orchestration (LangGraph-style) with guards/retries and history mining
- Model routing via .warp/models/*.yml (Anthropic/OpenAI/Gemini) with safe mock fallbacks
- Approval Gate Pyramid (auto/manual) driven by .warp/agent-config.yml globs
- Structured JSONL logging (runtime/events.jsonl) and lightweight dashboard UI (live stream + snapshots + filters)
- Events → UI mapping documented; snapshots for demos (happy/escalation/edge)

New
- Agents (concrete): planner, executor, validator
- Providers/router: Anthropic, OpenAI, Gemini; router resolves profiles to clients
- E2E scenarios: tools/e2e (happy path, escalation+error, edge cases)
- Dashboard public UI with color-coding and "Load snapshot"
- CI validator: agents_check.py (docstrings, samples, config parsing)

Commands (quick start)
- Dashboard: cd tools/dashboard && npm install && npm run start
- E2E: pwsh -File tools/e2e/run_all.ps1 or bash tools/e2e/run_all.sh
- Direct steps (bash):
  - bash 05_WORKFLOWS/slash-commands/build/build.sh
  - bash 05_WORKFLOWS/slash-commands/test/test.sh
  - bash 05_WORKFLOWS/slash-commands/plan/plan.sh "Project status"

Scenarios supported
- Happy path: plan → execute (auto-approval) → validate; green end
- Escalation: simulates risky actions (manual approval) and an injected error to exercise guards/retries
- Edge cases: empty goal + unicode goals; stable events/logging

Known limitations
- Providers default to mock if API keys are not set (by design for local UX)
- Executor outputs are proposals (dry-run); no destructive operations are executed
- Approval flow is simulated; no real human gate wiring beyond events and policy

Credits
- Core: Warp Development System contributors
- Special thanks to reviewers and early testers

## v0.2.0 - Agent-Led Autopilot
- Agent-led model: WARP.md updated; human consulted only for critical actions
- Approval policy tuned: auto-apply safe docs/CI, manual for critical globs
- New commands: /init (bootstrap), /next (single step), /autopilot (multi-cycle)
- New docs: CRITICAL_ACTIONS.md, AUTOPILOT.md; GUIDE.md reframed for agent-led
- README Quick start: highlights /init → /next → /autopilot flow

## v0.1.0 - Initial scaffold
- Repository structure and .warp configs
- Modules 01–11 with stubs and guides
- Workflows: slash-commands, orchestration templates, GitHub Actions (linting)
- Team sync notebooks and shared workflows
- Examples 01–06 and repository guardrails (.github, editorconfig, gitattributes)
