#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE:-$OPENCLAW_HOME/workspace}"
WORKSPACE_SKILLS_DIR="$WORKSPACE_DIR/skills"
TARGET_SKILL_DIR="$WORKSPACE_SKILLS_DIR/openclaw-forum-bot"
CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"
TARGET_HELPER_DIR="$WORKSPACE_SKILLS_DIR/forum-mcp-smoke"
SOURCE_ROOT_FILE="$SKILL_DIR/.agents-forum-source-root"

resolve_repo_root() {
  if [[ -f "$SOURCE_ROOT_FILE" ]]; then
    cat "$SOURCE_ROOT_FILE"
    return
  fi

  cd "$SKILL_DIR/../.." && pwd -P
}

REPO_ROOT="$(resolve_repo_root)"
HELPER_BOOTSTRAP_DIR="$REPO_ROOT/skills/openclaw-forum-bootstrap"
MCP_SERVER_FILE="$REPO_ROOT/apps/forum-api/src/modules/mcp/server.mjs"

print_item() {
  local label="$1"
  local status="$2"
  local detail="$3"
  printf '%-18s %-5s %s\n' "$label" "$status" "$detail"
}

main() {
  print_item "skill" "OK" "$SKILL_DIR"
  print_item "openclaw-home" "OK" "$OPENCLAW_HOME"
  print_item "workspace" "OK" "$WORKSPACE_DIR"
  print_item "workspace-skills" "OK" "$WORKSPACE_SKILLS_DIR"

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

  if [[ -f "$MCP_SERVER_FILE" ]]; then
    print_item "forum-mcp" "OK" "$MCP_SERVER_FILE"
  else
    print_item "forum-mcp" "MISS" "$MCP_SERVER_FILE"
  fi

  if [[ -e "$TARGET_SKILL_DIR" || -L "$TARGET_SKILL_DIR" ]]; then
    print_item "workspace-skill" "OK" "$TARGET_SKILL_DIR"
  else
    print_item "workspace-skill" "MISS" "$TARGET_SKILL_DIR"
  fi

  if [[ -d "$HELPER_BOOTSTRAP_DIR" ]]; then
    print_item "helper-bootstrap" "OK" "$HELPER_BOOTSTRAP_DIR"
  else
    print_item "helper-bootstrap" "MISS" "$HELPER_BOOTSTRAP_DIR"
  fi

  if [[ -d "$TARGET_HELPER_DIR" ]]; then
    print_item "helper-smoke" "OK" "$TARGET_HELPER_DIR"
  else
    print_item "helper-smoke" "MISS" "$TARGET_HELPER_DIR"
  fi

  if [[ -x "$SKILL_DIR/scripts/install-check.sh" ]]; then
    print_item "install-check" "OK" "$SKILL_DIR/scripts/install-check.sh"
  else
    print_item "install-check" "MISS" "$SKILL_DIR/scripts/install-check.sh"
  fi

  if [[ -x "$SKILL_DIR/scripts/smoke.sh" ]]; then
    print_item "smoke" "OK" "$SKILL_DIR/scripts/smoke.sh"
  else
    print_item "smoke" "MISS" "$SKILL_DIR/scripts/smoke.sh"
  fi

  if [[ -n "${FORUM_MCP_LOGIN_USER:-}" ]]; then
    print_item "login-user" "OK" "$FORUM_MCP_LOGIN_USER"
  else
    print_item "login-user" "MISS" "FORUM_MCP_LOGIN_USER not set"
  fi

  if [[ -n "${FORUM_MCP_LOGIN_PASSWORD:-}" ]]; then
    print_item "login-pass" "OK" "configured"
  else
    print_item "login-pass" "MISS" "FORUM_MCP_LOGIN_PASSWORD not set"
  fi
}

main "$@"
