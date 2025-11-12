#!/usr/bin/env bash
set -euo pipefail
ENV="${1:-dev}"
echo "[/deploy] Planning deploy to ${ENV}..."
# TODO: Implement deployment steps (build, push, rollout)
echo "[/deploy] Done."
