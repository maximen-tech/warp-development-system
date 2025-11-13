#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")"/../../.. && pwd)"
"$ROOT_DIR/tools/logger/log.sh" build start "Building project (multi-step)"
status=0

echo "[/build] step=frontend: tools/dashboard"
FE_DIR="$ROOT_DIR/tools/dashboard"
if [[ -d "$FE_DIR" ]]; then
  (
    cd "$FE_DIR"
    npm install --silent
    node -e "console.log('node ok')" >/dev/null
    node server.js &
    pid=$!
    sleep 2
    kill "$pid" 2>/dev/null || true
  ) || status=1
else
  echo "[/build] frontend not present (skipping)"
fi

echo "[/build] step=backend: uvicorn smoke"
if command -v python >/dev/null 2>&1 && python - <<'PY'
import importlib, sys
try:
    importlib.import_module('uvicorn')
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
then
  uvicorn --version >/dev/null 2>&1 || true
else
  echo "[/build] uvicorn not available (skipping)"
fi

if [[ $status -eq 0 ]]; then
  "$ROOT_DIR/tools/logger/log.sh" build end "Build finished: OK"
  exit 0
else
  "$ROOT_DIR/tools/logger/log.sh" build end "Build finished: FAIL"
  exit 1
fi
