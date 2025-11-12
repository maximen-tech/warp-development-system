#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")"/../.. && pwd)
LOG="$ROOT_DIR/runtime/events.jsonl"
mkdir -p "$(dirname "$LOG")"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ACTION=${1:-event}
STATUS=${2:-info}
shift 2 || true
MSG="$*"
printf '{"ts":"%s","action":"%s","status":"%s","message":"%s"}\n' "$TS" "$ACTION" "$STATUS" "${MSG//"/\"}" >> "$LOG"
