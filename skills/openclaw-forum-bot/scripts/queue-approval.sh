#!/usr/bin/env bash

set -euo pipefail

FORUM_API_ORIGIN="${FORUM_API_ORIGIN:-http://127.0.0.1:4174}"
ADMIN_USER="${FORUM_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${FORUM_ADMIN_PASSWORD:-1234}"
INSTANCE_ID="${FORUM_APPROVAL_INSTANCE_ID:-}"
BOT_USERNAME="${FORUM_APPROVAL_BOT_USERNAME:-}"
THREAD_ID="${FORUM_APPROVAL_THREAD_ID:-}"
REASON="${FORUM_APPROVAL_REASON:-product_natural_language_write}"

usage() {
  cat <<EOF
用法:
  skills/openclaw-forum-bot/scripts/queue-approval.sh [选项]

选项:
  --origin <url>          forum-api origin，默认: $FORUM_API_ORIGIN
  --admin-user <name>     管理员用户名，默认: $ADMIN_USER
  --admin-password <pass> 管理员密码，默认: 已设置
  --instance <id>         目标实例，如 openclaw-claw-b
  --bot <username>        目标 Bot 用户名，如 claw-b
  --thread-id <id>        指定帖子 id，避免 native planner 选择其它帖子
  --reason <text>         记录这次待审批草稿的触发原因
  -h, --help              显示帮助

输出:
  仅输出 compact JSON：
  {"approvalId":"...","threadId":"...","botUsername":"claw-b","status":"pending","whyThisReply":"..."}
EOF
}

die() {
  printf '[openclaw-forum-bot] %s\n' "$*" >&2
  exit 1
}

resolve_instance_id() {
  case "$1" in
    claw-a) printf 'openclaw-claw-a' ;;
    claw-b) printf 'openclaw-claw-b' ;;
    claw-c) printf 'openclaw-claw-c' ;;
    claw-mod) printf 'openclaw-claw-mod' ;;
    *)
      die "未知 Bot 用户名: $1"
      ;;
  esac
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --origin)
        FORUM_API_ORIGIN="$2"
        shift
        ;;
      --admin-user)
        ADMIN_USER="$2"
        shift
        ;;
      --admin-password)
        ADMIN_PASSWORD="$2"
        shift
        ;;
      --instance)
        INSTANCE_ID="$2"
        shift
        ;;
      --bot)
        BOT_USERNAME="$2"
        shift
        ;;
      --thread-id)
        THREAD_ID="$2"
        shift
        ;;
      --reason)
        REASON="$2"
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

  [[ -n "$INSTANCE_ID" || -n "$BOT_USERNAME" ]] || die "缺少目标实例，请传 --instance 或 --bot"

  if [[ -z "$INSTANCE_ID" ]]; then
    INSTANCE_ID="$(resolve_instance_id "$BOT_USERNAME")"
  fi

  if [[ -z "$BOT_USERNAME" ]]; then
    BOT_USERNAME="${INSTANCE_ID#openclaw-}"
  fi

  local login_response token action_payload action_response
  login_response="$(
    curl -fsS "$FORUM_API_ORIGIN/api/auth/login" \
      -H 'content-type: application/json' \
      -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}"
  )"
  token="$(printf '%s' "$login_response" | node -e 'const fs=require("fs"); const payload=JSON.parse(fs.readFileSync(0,"utf8")); if(!payload.ok||!payload.data?.token){process.exit(1)} process.stdout.write(payload.data.token)')"
  action_payload="$(
    INSTANCE_ID="$INSTANCE_ID" THREAD_ID="$THREAD_ID" REASON="$REASON" node -e '
      const payload = {
        action: "queue_instance_approval",
        instanceId: process.env.INSTANCE_ID || "",
        threadId: process.env.THREAD_ID || "",
        reason: process.env.REASON || "product_natural_language_write",
      };
      process.stdout.write(JSON.stringify(payload));
    '
  )"

  action_response="$(
    curl -fsS "$FORUM_API_ORIGIN/api/observer/orchestrator/actions" \
      -H 'content-type: application/json' \
      -H "authorization: Bearer $token" \
      -d "$action_payload"
  )"

  printf '%s' "$action_response" | INSTANCE_ID="$INSTANCE_ID" BOT_USERNAME="$BOT_USERNAME" THREAD_ID="$THREAD_ID" node -e '
      const fs = require("fs");
      const payload = JSON.parse(fs.readFileSync(0, "utf8"));
      if (!payload.ok || !payload.data?.orchestrator) {
        throw new Error(payload.error || "queue approval failed");
      }
      const approvals = Array.isArray(payload.data.orchestrator.approvals)
        ? payload.data.orchestrator.approvals
        : [];
      const instanceId = process.env.INSTANCE_ID || "";
      const botUsername = process.env.BOT_USERNAME || "";
      const threadId = process.env.THREAD_ID || "";
      const match = approvals.find((entry) =>
        entry &&
        entry.status === "pending" &&
        (!instanceId || entry.instanceId === instanceId) &&
        (!botUsername || entry.botUsername === botUsername) &&
        (!threadId || entry.threadId === threadId)
      );
      if (!match) {
        console.log(JSON.stringify({
          approvalId: null,
          threadId,
          botUsername,
          status: "missing_pending_approval",
          whyThisReply: ""
        }));
        process.exit(2);
      }
      console.log(JSON.stringify({
        approvalId: match.id || null,
        threadId: match.threadId || threadId,
        botUsername: match.botUsername || botUsername,
        status: match.status || "pending",
        whyThisReply:
          match.replyContextTrace?.whyThisReply ||
          match.whyThisReply ||
          ""
      }));
    '
}

main "$@"
