#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE:-$OPENCLAW_HOME/workspace}"
WORKSPACE_SKILLS_DIR="$WORKSPACE_DIR/skills"
TARGET_SKILL_DIR="$WORKSPACE_SKILLS_DIR/openclaw-forum-bot"
SOURCE_ROOT_FILE="$SKILL_DIR/.agents-forum-source-root"

resolve_repo_root() {
  if [[ -f "$SOURCE_ROOT_FILE" ]]; then
    cat "$SOURCE_ROOT_FILE"
    return
  fi

  cd "$SKILL_DIR/../.." && pwd -P
}

REPO_ROOT="$(resolve_repo_root)"
HELPER_BOOTSTRAP="$REPO_ROOT/skills/openclaw-forum-bootstrap/scripts/bootstrap.sh"

FORCE=0
INSTALL_MODE="copy"
SKIP_HELPERS=0

usage() {
  cat <<'EOF'
用法:
  skills/openclaw-forum-bot/scripts/bootstrap.sh [选项]

选项:
  --copy           复制 skill 到 workspace（默认，OpenClaw 产品可发现）
  --symlink        建立符号链接到 workspace，仅适合仓库内调试
  --force          覆盖已有目标
  --skip-helpers   不调用 openclaw-forum-bootstrap 安装 helper skill
  -h, --help       显示帮助
EOF
}

log() {
  printf '[openclaw-forum-bot] %s\n' "$*"
}

die() {
  printf '[openclaw-forum-bot] %s\n' "$*" >&2
  exit 1
}

ensure_workspace() {
  mkdir -p "$WORKSPACE_SKILLS_DIR"
}

remove_target_if_needed() {
  if [[ ! -e "$TARGET_SKILL_DIR" && ! -L "$TARGET_SKILL_DIR" ]]; then
    return
  fi

  if [[ "$FORCE" -ne 1 ]]; then
    log "检测到已有 workspace skill，保留现状: $TARGET_SKILL_DIR"
    return
  fi

  rm -rf "$TARGET_SKILL_DIR"
  log "已移除旧目标: $TARGET_SKILL_DIR"
}

install_self() {
  remove_target_if_needed

  if [[ -e "$TARGET_SKILL_DIR" || -L "$TARGET_SKILL_DIR" ]]; then
    return
  fi

  if [[ "$INSTALL_MODE" == "copy" ]]; then
    cp -R "$SKILL_DIR" "$TARGET_SKILL_DIR"
    log "已复制 openclaw-forum-bot 到 workspace"
    return
  fi

  ln -s "$SKILL_DIR" "$TARGET_SKILL_DIR"
  log "已建立 openclaw-forum-bot 符号链接到 workspace"
}

install_helpers() {
  local helper_args=()

  if [[ "$SKIP_HELPERS" -eq 1 ]]; then
    return
  fi

  [[ -x "$HELPER_BOOTSTRAP" ]] || die "未找到 helper bootstrap: $HELPER_BOOTSTRAP"

  if [[ "$FORCE" -eq 1 ]]; then
    helper_args+=(--force)
  fi

  if [[ "$INSTALL_MODE" == "symlink" ]]; then
    helper_args+=(--symlink)
  fi

  "$HELPER_BOOTSTRAP" "${helper_args[@]}"
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
      --skip-helpers)
        SKIP_HELPERS=1
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

  ensure_workspace
  install_helpers
  install_self
  "$SKILL_DIR/scripts/status.sh"
}

main "$@"
