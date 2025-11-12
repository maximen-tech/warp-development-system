# Auto-Execution Safety (Approval Gate Hierarchy)

Principles
- Propose → Preview → Approve → Apply
- Small diffs only; block mass file changes
- Require manual gate for prod-impacting workflows

Rules (examples)
- Block secret exposure; enforce placeholders
- Disallow force-push and destructive commands
- Run in dry-run/safe mode by default
