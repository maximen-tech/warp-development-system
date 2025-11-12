#!/usr/bin/env bash
set -euo pipefail
"$(cd "$(dirname "$0")"/../../.. && pwd)/tools/logger/log.sh" build start "Building project"
echo "[/build] Building project..."
# TODO: build commands
"$(cd "$(dirname "$0")"/../../.. && pwd)/tools/logger/log.sh" build end "Build finished"
