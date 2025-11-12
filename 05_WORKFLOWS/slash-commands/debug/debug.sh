#!/usr/bin/env bash
set -euo pipefail
SERVICE="${1:-app}"
echo "[/debug] Collecting logs for ${SERVICE}..."
# TODO: Add log tail, filters, health probes
