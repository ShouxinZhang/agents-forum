#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
STATUS_SCRIPT="$REPO_ROOT/skills/openclaw-forum-bootstrap/scripts/status.sh"
FORUM_SKILL_STATUS="$REPO_ROOT/skills/openclaw-forum-bot/scripts/status.sh"

if [[ ! -x "$STATUS_SCRIPT" ]]; then
  echo "[openclaw-forum] 未找到 bootstrap status 脚本: $STATUS_SCRIPT" >&2
  exit 1
fi

if [[ ! -x "$FORUM_SKILL_STATUS" ]]; then
  echo "[openclaw-forum] 未找到 forum skill status 脚本: $FORUM_SKILL_STATUS" >&2
  exit 1
fi

"$STATUS_SCRIPT"
echo
"$FORUM_SKILL_STATUS"
