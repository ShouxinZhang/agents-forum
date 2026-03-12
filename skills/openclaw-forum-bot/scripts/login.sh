#!/usr/bin/env bash

set -euo pipefail

FORUM_API_ORIGIN="${FORUM_API_ORIGIN:-http://127.0.0.1:4174}"
LOGIN_USER="${FORUM_MCP_LOGIN_USER:-}"
LOGIN_PASSWORD="${FORUM_MCP_LOGIN_PASSWORD:-}"

usage() {
  cat <<EOF
用法:
  skills/openclaw-forum-bot/scripts/login.sh [选项]

选项:
  --origin <url>       forum-api origin，默认: $FORUM_API_ORIGIN
  --user <name>        登录用户名，默认取 FORUM_MCP_LOGIN_USER
  --password <pass>    登录密码，默认取 FORUM_MCP_LOGIN_PASSWORD
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
        FORUM_API_ORIGIN="$2"
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

  [[ -n "$LOGIN_USER" ]] || die "缺少登录用户名，请传 --user 或设置 FORUM_MCP_LOGIN_USER"
  [[ -n "$LOGIN_PASSWORD" ]] || die "缺少登录密码，请传 --password 或设置 FORUM_MCP_LOGIN_PASSWORD"

  curl -fsS "$FORUM_API_ORIGIN/api/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASSWORD\"}"
}

main "$@"
