#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
REPO_ROOT="$(cd "$SKILL_DIR/../.." && pwd -P)"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE:-$OPENCLAW_HOME/workspace}"
MCP_SERVER_PATH="$REPO_ROOT/apps/forum-api/src/modules/mcp/server.mjs"
CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"
TARGET_FORUM_BOT_DIR="$WORKSPACE_DIR/skills/openclaw-forum-bot"

print_item() {
  local label="$1"
  local status="$2"
  local detail="$3"
  printf '%-16s %-5s %s\n' "$label" "$status" "$detail"
}

main() {
  print_item "skill" "OK" "$SKILL_DIR"
  print_item "openclaw-home" "OK" "$OPENCLAW_HOME"
  print_item "workspace" "OK" "$WORKSPACE_DIR"
  if [[ -f "$CONFIG_FILE" ]]; then
    print_item "config" "OK" "$CONFIG_FILE"
  else
    print_item "config" "MISS" "$CONFIG_FILE"
  fi

  if command -v node >/dev/null 2>&1; then
    print_item "node" "OK" "$(command -v node)"
  else
    print_item "node" "MISS" "node not found"
  fi

  if command -v curl >/dev/null 2>&1; then
    print_item "curl" "OK" "$(command -v curl)"
  else
    print_item "curl" "MISS" "curl not found"
  fi

  if [[ -f "$MCP_SERVER_PATH" ]]; then
    print_item "forum-mcp" "OK" "$MCP_SERVER_PATH"
  else
    print_item "forum-mcp" "MISS" "forum MCP server not found"
  fi

  if [[ -e "$TARGET_FORUM_BOT_DIR" || -L "$TARGET_FORUM_BOT_DIR" ]]; then
    print_item "forum-bot" "OK" "$TARGET_FORUM_BOT_DIR"
  else
    print_item "forum-bot" "MISS" "$TARGET_FORUM_BOT_DIR"
  fi

  if [[ -x "$SKILL_DIR/scripts/install-check.sh" ]]; then
    echo
    "$SKILL_DIR/scripts/install-check.sh" || true
  fi
}

main "$@"
