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
SOURCE_ROOT_MARKER=".agents-forum-source-root"

FORCE=0
INSTALL_MODE="copy"
RUN_SMOKE=0

usage() {
  cat <<'EOF'
用法:
  skills/openclaw-forum-bootstrap/scripts/bootstrap.sh [选项]

选项:
  --copy         复制 skill 到 workspace（默认，OpenClaw 产品可发现）
  --symlink      建立符号链接到 workspace，仅适合仓库内调试
  --force        覆盖已有目标
  --run-smoke    安装完成后执行 workspace 中的 forum-mcp-smoke
  -h, --help     显示帮助
EOF
}

log() {
  printf '[openclaw-forum-bootstrap] %s\n' "$*"
}

die() {
  printf '[openclaw-forum-bootstrap] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少依赖: $1"
}

ensure_workspace() {
  mkdir -p "$WORKSPACE_SKILLS_DIR"
}

write_source_root_marker() {
  local target_dir="$1"

  if [[ ! -d "$target_dir" ]]; then
    return
  fi

  printf '%s\n' "$REPO_ROOT" >"$target_dir/$SOURCE_ROOT_MARKER"
}

config_workspace_value() {
  if [[ "$WORKSPACE_DIR" == "$HOME/.openclaw/workspace" ]]; then
    printf '~/.openclaw/workspace'
    return
  fi

  printf '%s' "$WORKSPACE_DIR"
}

ensure_config() {
  mkdir -p "$OPENCLAW_HOME"
  local workspace_value
  workspace_value="$(config_workspace_value)"

  if [[ -f "$CONFIG_FILE" ]]; then
    if grep -Fq "\"$workspace_value\"" "$CONFIG_FILE" || grep -Fq "workspace: \"$workspace_value\"" "$CONFIG_FILE"; then
      log "检测到已有 $CONFIG_FILE，保留现状"
      return
    fi

    cat <<EOF
[openclaw-forum-bootstrap] 检测到已有 $CONFIG_FILE，未自动修改。
[openclaw-forum-bootstrap] 请手动确认至少包含以下片段：
{
  agents: {
    defaults: {
      workspace: "$workspace_value",
    },
  },
}
EOF
    return
  fi

  cat >"$CONFIG_FILE" <<'EOF'
{
  agents: {
    defaults: {
      workspace: "__WORKSPACE__",
    },
  },
}
EOF
  python3 - <<PY
from pathlib import Path
path = Path("$CONFIG_FILE")
content = path.read_text(encoding="utf-8")
path.write_text(content.replace("__WORKSPACE__", "$workspace_value"), encoding="utf-8")
PY
  log "已生成 $CONFIG_FILE"
}

remove_target_if_needed() {
  if [[ ! -e "$TARGET_SMOKE_DIR" && ! -L "$TARGET_SMOKE_DIR" ]]; then
    return
  fi

  if [[ "$FORCE" -ne 1 ]]; then
    log "检测到已存在的 workspace skill，保留现状: $TARGET_SMOKE_DIR"
    return
  fi

  rm -rf "$TARGET_SMOKE_DIR"
  log "已移除旧目标: $TARGET_SMOKE_DIR"
}

install_smoke_skill() {
  [[ -d "$SOURCE_SMOKE_DIR" ]] || die "未找到源 skill: $SOURCE_SMOKE_DIR"

  remove_target_if_needed

  if [[ -e "$TARGET_SMOKE_DIR" || -L "$TARGET_SMOKE_DIR" ]]; then
    return
  fi

  if [[ "$INSTALL_MODE" == "copy" ]]; then
    cp -R "$SOURCE_SMOKE_DIR" "$TARGET_SMOKE_DIR"
    write_source_root_marker "$TARGET_SMOKE_DIR"
    log "已复制 forum-mcp-smoke 到 workspace"
    return
  fi

  ln -s "$SOURCE_SMOKE_DIR" "$TARGET_SMOKE_DIR"
  log "已建立 forum-mcp-smoke 符号链接到 workspace"
}

remove_forum_bot_if_needed() {
  if [[ ! -e "$TARGET_FORUM_BOT_DIR" && ! -L "$TARGET_FORUM_BOT_DIR" ]]; then
    return
  fi

  if [[ "$FORCE" -ne 1 ]]; then
    log "检测到已存在的 forum skill，保留现状: $TARGET_FORUM_BOT_DIR"
    return
  fi

  rm -rf "$TARGET_FORUM_BOT_DIR"
  log "已移除旧 forum skill 目标: $TARGET_FORUM_BOT_DIR"
}

install_forum_bot_skill() {
  [[ -d "$SOURCE_FORUM_BOT_DIR" ]] || die "未找到源 skill: $SOURCE_FORUM_BOT_DIR"

  remove_forum_bot_if_needed

  if [[ -e "$TARGET_FORUM_BOT_DIR" || -L "$TARGET_FORUM_BOT_DIR" ]]; then
    return
  fi

  if [[ "$INSTALL_MODE" == "copy" ]]; then
    cp -R "$SOURCE_FORUM_BOT_DIR" "$TARGET_FORUM_BOT_DIR"
    write_source_root_marker "$TARGET_FORUM_BOT_DIR"
    log "已复制 openclaw-forum-bot 到 workspace"
    return
  fi

  ln -s "$SOURCE_FORUM_BOT_DIR" "$TARGET_FORUM_BOT_DIR"
  log "已建立 openclaw-forum-bot 符号链接到 workspace"
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --copy)
        INSTALL_MODE="copy"
        ;;
      --symlink)
        INSTALL_MODE="symlink"
        ;;
      --force)
        FORCE=1
        ;;
      --run-smoke)
        RUN_SMOKE=1
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

  require_cmd node
  ensure_workspace
  ensure_config
  install_smoke_skill
  install_forum_bot_skill

  "$SKILL_DIR/scripts/install-check.sh"

  if [[ "$RUN_SMOKE" -eq 1 ]]; then
    "$TARGET_FORUM_BOT_DIR/scripts/smoke.sh"
  fi

  cat <<EOF

[openclaw-forum-bootstrap] 初始化完成
- repo root: $REPO_ROOT
- OpenClaw config: $CONFIG_FILE
- OpenClaw workspace: $WORKSPACE_DIR
- workspace skills: $WORKSPACE_SKILLS_DIR
- installed skill: $TARGET_SMOKE_DIR
- installed forum skill: $TARGET_FORUM_BOT_DIR

下一步:
1. 检查状态: $SKILL_DIR/scripts/status.sh
2. 验证 forum skill: $TARGET_FORUM_BOT_DIR/scripts/status.sh
3. 运行 smoke: $TARGET_FORUM_BOT_DIR/scripts/smoke.sh
4. 若要让 OpenClaw 产品扫描到 forum skill，优先保持 copy 安装；外部 symlink 会被跳过
5. 后续接入 forum MCP / openclaw-forum-bot 时，继续复用这个 workspace 安装链路
EOF
}

main "$@"
