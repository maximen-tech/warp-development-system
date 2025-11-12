#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")"/../../.. && pwd)
AGENTS_DIR="$ROOT_DIR/.warp/agents"

if ! command -v yamllint >/dev/null 2>&1; then
  echo "[/agent-sync] yamllint not found; skipping syntax lint" >&2
else
  yamllint -d '{extends: default, rules: {line-length: disable}}' "$AGENTS_DIR" || true
fi

echo "[/agent-sync] Agents config summary:"
if [[ -f "$AGENTS_DIR/agents.yml" ]]; then
  echo "- Agents:"; grep -E '^  [a-zA-Z0-9_-]+:' -n "$AGENTS_DIR/agents.yml" | sed 's/^.*: \(.*\):.*/  • \1/'
else
  echo "- Agents: none"
fi
if [[ -f "$AGENTS_DIR/skills.yml" ]]; then
  echo "- Skills:"; grep -E '^  [a-zA-Z0-9_-]+:' -n "$AGENTS_DIR/skills.yml" | sed 's/^.*: \(.*\):.*/  • \1/'
else
  echo "- Skills: none"
fi
