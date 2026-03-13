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
WORKSPACE_SKILLS_DIR="$WORKSPACE_DIR/skills"
TARGET_SKILL_DIR="$WORKSPACE_SKILLS_DIR/openclaw-forum-bot"
TARGET_HELPER_DIR="$WORKSPACE_SKILLS_DIR/forum-mcp-smoke"
CONFIG_FILE="${OPENCLAW_CONFIG_PATH:-$OPENCLAW_STATE_DIR/openclaw.json}"
SOURCE_ROOT_FILE="$SKILL_DIR/.agents-forum-source-root"

resolve_repo_root() {
  if [[ -f "$SOURCE_ROOT_FILE" ]]; then
    cat "$SOURCE_ROOT_FILE"
    return
  fi

  cd "$SKILL_DIR/../.." && pwd -P
}

REPO_ROOT="$(resolve_repo_root)"
MCP_SERVER_FILE="$REPO_ROOT/apps/forum-api/src/modules/mcp/server.mjs"

print_item() {
  local label="$1"
  local status="$2"
  local detail="$3"
  printf '%-20s %-5s %s\n' "$label" "$status" "$detail"
}

check_path() {
  local label="$1"
  local target="$2"
  if [[ -e "$target" || -L "$target" ]]; then
    print_item "$label" "OK" "$target"
    return 0
  fi

  print_item "$label" "MISS" "$target"
  return 1
}

check_workspace_locality() {
  local label="$1"
  local target="$2"

  if [[ ! -e "$target" && ! -L "$target" ]]; then
    return 0
  fi

  local resolved workspace_real
  resolved="$(python3 - "$target" <<'PY'
from pathlib import Path
import sys
print(Path(sys.argv[1]).resolve())
PY
)"
  workspace_real="$(python3 - "$WORKSPACE_DIR" <<'PY'
from pathlib import Path
import sys
print(Path(sys.argv[1]).resolve())
PY
)"

  case "$resolved" in
    "$workspace_real"/*|"$workspace_real")
      print_item "$label" "OK" "$resolved"
      return 0
      ;;
    *)
      print_item "$label" "FAIL" "$resolved (OpenClaw 产品会跳过 workspace 外部 skill)"
      return 1
      ;;
  esac
}

main() {
  local missing=0

  check_path "config" "$CONFIG_FILE" || missing=1
  check_path "workspace" "$WORKSPACE_DIR" || missing=1
  check_path "skills-dir" "$WORKSPACE_SKILLS_DIR" || missing=1
  check_path "source-skill" "$SKILL_DIR" || missing=1
  check_path "target-skill" "$TARGET_SKILL_DIR" || missing=1
  check_workspace_locality "target-skill-loc" "$TARGET_SKILL_DIR" || missing=1
  check_path "target-skill-md" "$TARGET_SKILL_DIR/SKILL.md" || missing=1
  check_path "target-status" "$TARGET_SKILL_DIR/scripts/status.sh" || missing=1
  check_path "helper-smoke" "$TARGET_HELPER_DIR" || missing=1
  check_workspace_locality "helper-smoke-loc" "$TARGET_HELPER_DIR" || missing=1
  check_path "forum-mcp" "$MCP_SERVER_FILE" || missing=1

  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

main "$@"
