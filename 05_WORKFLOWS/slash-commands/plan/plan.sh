#!/usr/bin/env bash
set -euo pipefail
TASK="${1:-Project status}"
ROOT_DIR="$(cd "$(dirname "$0")"/../../.. && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime"
OUT="$RUNTIME_DIR/plan.md"
mkdir -p "$RUNTIME_DIR"

echo "[/plan] Planning: ${TASK}"
{
  echo "# Plan"
  echo "Task: ${TASK}"
  echo "\n## Top-level directories"
  find "$ROOT_DIR" -maxdepth 1 -type d -not -path '*/.*' | sed "s|$ROOT_DIR/||" | sort
  echo "\n## File count"
  (cd "$ROOT_DIR" && git ls-files | wc -l)
  echo "\n## Modules (README excerpt)"
  sed -n '13,23p' "$ROOT_DIR/README.md" 2>/dev/null || true
  echo "\n## Next steps (README excerpt)"
  sed -n '39,43p' "$ROOT_DIR/README.md" 2>/dev/null || true
} | tee "$OUT"

echo "[/plan] wrote $OUT"
