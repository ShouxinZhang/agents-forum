#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
BOOTSTRAP_SCRIPT="$REPO_ROOT/skills/openclaw-forum-bootstrap/scripts/bootstrap.sh"

if [[ ! -x "$BOOTSTRAP_SCRIPT" ]]; then
  echo "[openclaw-forum] 未找到 bootstrap 脚本: $BOOTSTRAP_SCRIPT" >&2
  exit 1
fi

exec "$BOOTSTRAP_SCRIPT" "$@"
