# v1.0.0 — Warp Development System

Warp Development System atteint sa v1.0.0 avec une orchestration multi‑agents prête pour la prod, un routing LLM flexible, des garde‑fous d’approbation, un logging structuré et une mini‑UI de dashboard en temps réel. Cette version fournit une expérience de bout en bout: plan → exécution → validation, traçable dans des events JSONL et visualisable en live ou via snapshots.

## Key features
- Orchestration multi‑agents (LangGraph‑style)
  - Guards/retries et history mining des étapes
  - Séparation planning/execution/validation (Patterns 1/3/4/11/12)
- Routing LLM via `.warp/models/*.yml`
  - Providers: Anthropic, OpenAI, Gemini
  - Safe mock fallbacks si aucune clé n’est définie (UX locale robuste)
- Approval Gate Pyramid
  - Auto/manual via `.warp/agent-config.yml` (globs)
  - Évènements `awaiting_approval` pour escalades
- Logging structuré + Dashboard UI
  - `runtime/events.jsonl` (SSE en live)
  - Mini‑UI (live + "Load snapshot", filtres Errors/Awaiting)
  - Color-coding et mapping Events → UI (documenté)

## Workflows and commands
- Dashboard
  - `cd tools/dashboard && npm install && npm run start`
  - Ouvrir http://localhost:3030, bouton “Load snapshot” pour happy/escalation/edge
- E2E scenarios
  - PowerShell: `pwsh -File tools/e2e/run_all.ps1`
  - Bash: `bash tools/e2e/run_all.sh`
  - Snapshots: `runtime/scenarios/happy.jsonl`, `escalation.jsonl`, `edge.jsonl`
- Steps de base (bash)
  - `bash 05_WORKFLOWS/slash-commands/build/build.sh`
  - `bash 05_WORKFLOWS/slash-commands/test/test.sh`
  - `bash 05_WORKFLOWS/slash-commands/plan/plan.sh "Project status"`

## Scenarios covered
- Happy path: auto‑approval, fin “validated”
- Escalation: actions “risky” (manual approval) + erreur simulée → guards/retries
- Edge cases: goal vide, unicode; events/logging stables

## Known limitations
- Providers en mock par défaut si clés API absentes (intentional pour dev local)
- Executor propose des commandes (dry‑run), pas d’opérations destructives
- Approval flow simulé (événements + policy), pas de gate humain externe

## Docs
- README: sections “Local orchestration demos” et “Events → UI mapping”
- CHANGELOG.md: entrée v1.0.0‑rc1 (contenu identique à la finale, hors numéro)
- `.warp/`: modèles, agents, et règles d’approbation

## Credits
- Core: Warp Development System contributors
- Merci aux reviewers et testeurs précoces
