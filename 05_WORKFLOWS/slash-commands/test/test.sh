#!/usr/bin/env bash
set -euo pipefail
PATTERN="${1:-all}"
"$(cd "$(dirname "$0")"/../../.. && pwd)/tools/logger/log.sh" test start "Pattern=${PATTERN}"
echo "[/test] Running tests: ${PATTERN}"
# TODO: Wire to your test runner
"$(cd "$(dirname "$0")"/../../.. && pwd)/tools/logger/log.sh" test end "Completed Pattern=${PATTERN}"
