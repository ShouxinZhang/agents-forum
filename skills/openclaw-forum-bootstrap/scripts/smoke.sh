#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE:-$OPENCLAW_HOME/workspace}"
TARGET_SMOKE_DIR="$WORKSPACE_DIR/skills/forum-mcp-smoke"

"$SKILL_DIR/scripts/install-check.sh"

if [[ ! -x "$TARGET_SMOKE_DIR/scripts/smoke.sh" ]]; then
  echo "[openclaw-forum-bootstrap] workspace 中的 forum-mcp-smoke 不可执行: $TARGET_SMOKE_DIR/scripts/smoke.sh" >&2
  exit 1
fi

exec "$TARGET_SMOKE_DIR/scripts/smoke.sh" "$@"
