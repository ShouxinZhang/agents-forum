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
SERVER_FILE="$REPO_ROOT/apps/forum-api/src/modules/mcp/server.mjs"

if [[ ! -f "$SERVER_FILE" ]]; then
  echo "[openclaw-forum-bootstrap] 未找到 forum MCP server: $SERVER_FILE" >&2
  exit 1
fi

exec node "$SERVER_FILE" "$@"
