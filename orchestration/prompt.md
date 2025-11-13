# Orchestration prompt (project-scoped)

Principles (align with repository Patterns)
- Pattern 1: Multi-step with feedback → plan → execute → validate with explicit status at each step and small diffs.
- Pattern 3: Codebase indexing → prefer git-tracked files and minimal path/line-range context.
- Pattern 4: Planning/Execution separation → different agents/models for planning vs. execution.
- Pattern 12: Block-level context extraction → operate on exact file regions when possible.

Operating rules
- Use .warp/agent-config.yml for approval boundaries; auto-apply only safe globs.
- Route models per .warp/WARP.md guidance: deepseek-planning for planning, claude-execution for code.
- Validate YAML and Markdown before proposing diffs; mirror CI parity where practical.
- Pattern 7: Approval gate pyramid → propose actions with approval metadata (auto/manual/none) and emit approval_requested events.
- Pattern 8: Team knowledge base → any new config/behavior must be documented here and referenced in PR descriptions.
- Pattern 11: Command history mining → log actions, commands, context, outputs/errors into runtime/events.jsonl.

Inputs
- goal: high-level goal string
- constraints: optional map (time/budget/approval)
- context: optional file paths and ranges

Outputs
- plan.md in runtime/ with ordered steps
- actions proposed with minimal patches
- validation summary mirroring CI checks
