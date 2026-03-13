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

ORIGIN="${FORUM_API_ORIGIN:-http://127.0.0.1:4174}"
LOGIN_USER="${FORUM_MCP_LOGIN_USER:-}"
LOGIN_PASSWORD="${FORUM_MCP_LOGIN_PASSWORD:-}"
WRITE_SMOKE=0

usage() {
  cat <<EOF
用法:
  skills/openclaw-forum-bot/scripts/smoke.sh [选项]

选项:
  --origin <url>       forum-api origin，默认: $ORIGIN
  --user <name>        登录用户名，默认取 FORUM_MCP_LOGIN_USER
  --password <pass>    登录密码，默认取 FORUM_MCP_LOGIN_PASSWORD
  --write-smoke        额外执行真实写入 smoke
  -h, --help           显示帮助
EOF
}

die() {
  printf '[openclaw-forum-bot] %s\n' "$*" >&2
  exit 1
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --origin)
        ORIGIN="$2"
        shift
        ;;
      --user)
        LOGIN_USER="$2"
        shift
        ;;
      --password)
        LOGIN_PASSWORD="$2"
        shift
        ;;
      --write-smoke)
        WRITE_SMOKE=1
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "未知参数: $1"
        ;;
    esac
    shift
  done

  "$SKILL_DIR/scripts/install-check.sh"

  if [[ ! -x "$TARGET_SMOKE_DIR/scripts/smoke.sh" ]]; then
    die "workspace 中的 forum-mcp-smoke 不可执行: $TARGET_SMOKE_DIR/scripts/smoke.sh"
  fi

  "$TARGET_SMOKE_DIR/scripts/smoke.sh" --origin "$ORIGIN"

  if [[ -n "$LOGIN_USER" || -n "$LOGIN_PASSWORD" || "$WRITE_SMOKE" -eq 1 ]]; then
    [[ -n "$LOGIN_USER" ]] || die "执行登录或写入 smoke 时必须提供 --user 或 FORUM_MCP_LOGIN_USER"
    [[ -n "$LOGIN_PASSWORD" ]] || die "执行登录或写入 smoke 时必须提供 --password 或 FORUM_MCP_LOGIN_PASSWORD"

    "$SKILL_DIR/scripts/login.sh" --origin "$ORIGIN" --user "$LOGIN_USER" --password "$LOGIN_PASSWORD" >/dev/null

    if [[ "$WRITE_SMOKE" -eq 1 ]]; then
      "$TARGET_SMOKE_DIR/scripts/smoke.sh" \
        --origin "$ORIGIN" \
        --write-smoke \
        --login-user "$LOGIN_USER" \
        --login-password "$LOGIN_PASSWORD"
    fi
  fi
}

main "$@"
