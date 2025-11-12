#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")"/../../.. && pwd)
CYCLES=${1:-3}
for ((i=1; i<=CYCLES; i++)); do
  echo "[/autopilot] Cycle $i/$CYCLES"
  bash "$ROOT_DIR/05_WORKFLOWS/slash-commands/next/next.sh" || true
done
echo "[/autopilot] Completed $CYCLES cycles."
