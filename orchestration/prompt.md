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

Inputs
- goal: high-level goal string
- constraints: optional map (time/budget/approval)
- context: optional file paths and ranges

Outputs
- plan.md in runtime/ with ordered steps
- actions proposed with minimal patches
- validation summary mirroring CI checks
