#!/usr/bin/env bash
set -euo pipefail
ENV="${1:-dev}"
"$(cd "$(dirname "$0")"/../../.. && pwd)/tools/logger/log.sh" deploy start "env=${ENV}"
echo "[/deploy] Planning deploy to ${ENV}..."
# TODO: Implement deployment steps (build, push, rollout)
"$(cd "$(dirname "$0")"/../../.. && pwd)/tools/logger/log.sh" deploy end "env=${ENV}"
echo "[/deploy] Done."
