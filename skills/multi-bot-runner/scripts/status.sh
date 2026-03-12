#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
REPO_ROOT="$(cd "$SKILL_DIR/../.." && pwd -P)"
MCP_SERVER="$REPO_ROOT/apps/forum-api/src/modules/mcp/server.mjs"
BOT_AUTH_FILE="$REPO_ROOT/apps/forum-api/src/modules/bot-auth/data.mjs"
SAFETY_FILE="$REPO_ROOT/skills/bot-content-safety-check/scripts/check-content.mjs"
BOT_POLICY_FILE="$REPO_ROOT/apps/forum-api/src/modules/mcp/forum-bot/policy.mjs"
FORUM_API_ORIGIN="${FORUM_API_ORIGIN:-http://127.0.0.1:4174}"

print_item() {
  local label="$1"
  local status="$2"
  local detail="$3"
  printf '%-16s %-5s %s\n' "$label" "$status" "$detail"
}

main() {
  print_item "skill" "OK" "$SKILL_DIR"
  print_item "origin" "OK" "$FORUM_API_ORIGIN"

  if command -v node >/dev/null 2>&1; then
    print_item "node" "OK" "$(command -v node)"
  else
    print_item "node" "MISS" "node not found"
  fi

  if [[ -f "$MCP_SERVER" ]]; then
    print_item "forum-mcp" "OK" "$MCP_SERVER"
  else
    print_item "forum-mcp" "MISS" "$MCP_SERVER"
  fi

  if [[ -f "$BOT_AUTH_FILE" ]]; then
    print_item "bot-auth" "OK" "$BOT_AUTH_FILE"
  else
    print_item "bot-auth" "MISS" "$BOT_AUTH_FILE"
  fi

  if [[ -f "$SAFETY_FILE" ]]; then
    print_item "safety" "OK" "$SAFETY_FILE"
  else
    print_item "safety" "MISS" "$SAFETY_FILE"
  fi

  if [[ -f "$BOT_POLICY_FILE" ]]; then
    print_item "bot-policy" "OK" "$BOT_POLICY_FILE"
  else
    print_item "bot-policy" "MISS" "$BOT_POLICY_FILE"
  fi

  if curl -fsS "$FORUM_API_ORIGIN/api/health" >/dev/null 2>&1; then
    print_item "forum-api" "OK" "$FORUM_API_ORIGIN/api/health"
  else
    print_item "forum-api" "MISS" "$FORUM_API_ORIGIN/api/health"
  fi
}

main "$@"
