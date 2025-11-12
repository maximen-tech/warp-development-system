# GitHub Integration (API, Actions, CLI)

Capabilities
- Issues/PRs automation via Actions
- Code scanning (SARIF) and approval gates
- gh CLI for local workflows

Setup
- Secrets: {{GITHUB_TOKEN}}
- Actions: see `05_WORKFLOWS/github-actions/*`
- MCP: `.warp/mcp-servers.yml` github section

Examples
- Auto-label PRs based on path
- Require manual approval before deploy
