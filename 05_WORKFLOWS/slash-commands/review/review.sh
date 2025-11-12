#!/usr/bin/env bash
set -euo pipefail
"$(cd "$(dirname "$0")"/../../.. && pwd)/tools/logger/log.sh" review start "Static checks and diff summary"
echo "[/review] Running static checks and preparing diff summary..."
# TODO: call linters and summarize git diff
"$(cd "$(dirname "$0")"/../../.. && pwd)/tools/logger/log.sh" review end "Review completed"
