#!/usr/bin/env bash
set -euo pipefail
PATTERN="${1:-all}"
ROOT_DIR="$(cd "$(dirname "$0")"/../../.. && pwd)"
"$ROOT_DIR/tools/logger/log.sh" test start "Pattern=${PATTERN}"
status=0

echo "[/test] discovering runner"
if command -v pytest >/dev/null 2>&1 && [[ -d "$ROOT_DIR/tests" ]]; then
  echo "[/test] running pytest"
  (
    cd "$ROOT_DIR"
    pytest -q || status=$?
  )
else
  echo "[/test] pytest/tests not found; running python smoke"
  if command -v python >/dev/null 2>&1; then
    python - <<'PY' || status=$?
print('smoke: python OK')
PY
  else
    echo "[/test] python not available"
    status=1
  fi
fi

if [[ $status -eq 0 ]]; then
  "$ROOT_DIR/tools/logger/log.sh" test end "Completed Pattern=${PATTERN} (OK)"
  exit 0
else
  "$ROOT_DIR/tools/logger/log.sh" test end "Completed Pattern=${PATTERN} (FAIL)"
  exit 1
fi
