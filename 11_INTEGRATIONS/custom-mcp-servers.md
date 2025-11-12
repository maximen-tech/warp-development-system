# Custom MCP Servers (Extend Capabilities)

Concept
- Wrap internal tools/APIs as MCP servers
- Enforce auth via env vars, least-privilege scopes

Design
- Stateless HTTP where possible; idempotent endpoints
- Clear input/output schemas

Steps
1) Define server contract
2) Add to `.warp/mcp-servers.yml`
3) Provide example prompts and workflows
