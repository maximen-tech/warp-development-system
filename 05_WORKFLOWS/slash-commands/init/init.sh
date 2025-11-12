#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")"/../../.. && pwd)
CFG="$ROOT_DIR/project.config.yml"

printf "[/init] Agent-led initialization...\n"
read -rp "Project type [web/api/cli] (web): " TYPE; TYPE=${TYPE:-web}
read -rp "Package manager [npm/pnpm/yarn] (npm): " PKG; PKG=${PKG:-npm}
read -rp "Build command (default: $PKG run build): " BUILD; BUILD=${BUILD:-"$PKG run build"}
read -rp "Test command (default: $PKG test): " TEST; TEST=${TEST:-"$PKG test"}
read -rp "Deploy target [none/staging/prod] (staging): " TARGET; TARGET=${TARGET:-staging}

cat > "$CFG" <<YAML
project:
  type: $TYPE
  package_manager: $PKG
commands:
  build: "$BUILD"
  test: "$TEST"
deploy:
  target: $TARGET
YAML

printf "[/init] Wrote %s\n" "$CFG"
