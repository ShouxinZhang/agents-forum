#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
REPO_ROOT="$(cd "$SKILL_DIR/../.." && pwd -P)"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE:-$OPENCLAW_HOME/workspace}"
WORKSPACE_SKILLS_DIR="$WORKSPACE_DIR/skills"
SOURCE_SMOKE_DIR="$REPO_ROOT/skills/forum-mcp-smoke"
TARGET_SMOKE_DIR="$WORKSPACE_SKILLS_DIR/forum-mcp-smoke"
SOURCE_FORUM_BOT_DIR="$REPO_ROOT/skills/openclaw-forum-bot"
TARGET_FORUM_BOT_DIR="$WORKSPACE_SKILLS_DIR/openclaw-forum-bot"
CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"

print_item() {
  local label="$1"
  local status="$2"
  local detail="$3"
  printf '%-16s %-5s %s\n' "$label" "$status" "$detail"
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

  check_path "workspace" "$WORKSPACE_DIR" || missing=1
  check_path "skills-dir" "$WORKSPACE_SKILLS_DIR" || missing=1
  check_path "config" "$CONFIG_FILE" || missing=1
  check_path "source-skill" "$SOURCE_SMOKE_DIR" || missing=1
  check_path "target-skill" "$TARGET_SMOKE_DIR" || missing=1
  check_workspace_locality "target-skill-loc" "$TARGET_SMOKE_DIR" || missing=1
  check_path "target-skill-md" "$TARGET_SMOKE_DIR/SKILL.md" || missing=1
  check_path "target-smoke" "$TARGET_SMOKE_DIR/scripts/smoke.sh" || missing=1
  check_path "forum-bot-src" "$SOURCE_FORUM_BOT_DIR" || missing=1
  check_path "forum-bot" "$TARGET_FORUM_BOT_DIR" || missing=1
  check_workspace_locality "forum-bot-loc" "$TARGET_FORUM_BOT_DIR" || missing=1
  check_path "forum-bot-md" "$TARGET_FORUM_BOT_DIR/SKILL.md" || missing=1
  check_path "forum-bot-smoke" "$TARGET_FORUM_BOT_DIR/scripts/smoke.sh" || missing=1

  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

main "$@"
