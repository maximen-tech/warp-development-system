#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")"/../../.. && pwd)
CFG="$ROOT_DIR/project.config.yml"
LOGGER="$ROOT_DIR/tools/logger/log.sh"
if [[ ! -f "$CFG" ]]; then
  echo "[/next] Missing project.config.yml — run /init first"; "$LOGGER" next error "missing config"; exit 1
fi

# Read minimal keys (best-effort)
PM=$(grep -E '^  package_manager:' -n "$CFG" | awk -F': ' '{print $3}' || true)
BUILD=$(grep -E '^  build:' -n "$CFG" | sed 's/.*build: \"\{0,1\}\(.*\)\"\{0,1\}/\1/' || true)
TEST=$(grep -E '^  test:' -n "$CFG" | sed 's/.*test: \"\{0,1\}\(.*\)\"\{0,1\}/\1/' || true)

"$LOGGER" next start "Planning next step"
echo "[/next] Planning next step..."
# Simple heuristic: if no changes staged, run build+test; else run review
if git diff --quiet && git diff --cached --quiet; then
  echo "[/next] No pending diffs. Running build and tests."
  "$LOGGER" next info "run build+test"
  [[ -n "$BUILD" ]] && bash -lc "$BUILD" || echo "No build command configured."
  [[ -n "$TEST" ]] && bash -lc "$TEST" || echo "No test command configured."
else
  echo "[/next] Changes detected. Running review."
  "$LOGGER" next info "run review"
  bash "$ROOT_DIR/05_WORKFLOWS/slash-commands/review/review.sh" || true
fi

"$LOGGER" next end "Done"
echo "[/next] Done."
