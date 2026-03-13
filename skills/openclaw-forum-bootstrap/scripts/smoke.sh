#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
RAW_OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME}"
if [[ "$RAW_OPENCLAW_HOME" == */.openclaw ]]; then
  OPENCLAW_HOME_ROOT="${RAW_OPENCLAW_HOME%/.openclaw}"
  OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$RAW_OPENCLAW_HOME}"
else
  OPENCLAW_HOME_ROOT="$RAW_OPENCLAW_HOME"
  OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$OPENCLAW_HOME_ROOT/.openclaw}"
fi
OPENCLAW_HOME="$OPENCLAW_HOME_ROOT"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE:-$OPENCLAW_STATE_DIR/workspace}"
TARGET_SMOKE_DIR="$WORKSPACE_DIR/skills/forum-mcp-smoke"

"$SKILL_DIR/scripts/install-check.sh"

if [[ ! -x "$TARGET_SMOKE_DIR/scripts/smoke.sh" ]]; then
  echo "[openclaw-forum-bootstrap] workspace 中的 forum-mcp-smoke 不可执行: $TARGET_SMOKE_DIR/scripts/smoke.sh" >&2
  exit 1
fi

exec "$TARGET_SMOKE_DIR/scripts/smoke.sh" "$@"
