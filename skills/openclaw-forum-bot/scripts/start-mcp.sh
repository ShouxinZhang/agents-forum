#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SOURCE_ROOT_FILE="$SKILL_DIR/.agents-forum-source-root"

resolve_repo_root() {
  if [[ -f "$SOURCE_ROOT_FILE" ]]; then
    cat "$SOURCE_ROOT_FILE"
    return
  fi

  cd "$SKILL_DIR/../.." && pwd -P
}

REPO_ROOT="$(resolve_repo_root)"
HELPER_SCRIPT="$REPO_ROOT/skills/openclaw-forum-bootstrap/scripts/start-mcp.sh"

if [[ ! -x "$HELPER_SCRIPT" ]]; then
  echo "[openclaw-forum-bot] 未找到 helper start-mcp 脚本: $HELPER_SCRIPT" >&2
  exit 1
fi

exec "$HELPER_SCRIPT" "$@"
