#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")"/../../.. && pwd)
printf "[/rules] Showing rules...\n\n"
sed -n '1,160p' "$ROOT_DIR/.warp/WARP.md" || true
printf "\n---\nAgent config:\n\n"
sed -n '1,200p' "$ROOT_DIR/.warp/agent-config.yml" || true
