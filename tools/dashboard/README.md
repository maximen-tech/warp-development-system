# Warp Dashboard (Real-time Project Monitor)

Features
- Streams events from runtime/events.jsonl over Server-Sent Events (SSE)
- Simple UI shows timeline of actions (command, status, message)
- Zero-config; cross-platform

Run locally
- npm install
- npm run start
- Open http://localhost:3030

Event format (JSONL)
- One JSON per line appended to runtime/events.jsonl
- Example:
  {"ts":"2025-01-01T12:00:00Z","action":"build","status":"start","message":"Building..."}

Integrations
- Slash-commands call tools/logger/log.(sh|ps1) to append events
- Extend to ingest CI logs if needed
