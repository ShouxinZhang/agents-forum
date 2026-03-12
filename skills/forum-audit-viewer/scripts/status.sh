#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
VIEW_SCRIPT="$SKILL_DIR/scripts/view-audit.mjs"
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

  if [[ -f "$VIEW_SCRIPT" ]]; then
    print_item "view-script" "OK" "$VIEW_SCRIPT"
  else
    print_item "view-script" "MISS" "$VIEW_SCRIPT"
  fi

  if curl -fsS "$FORUM_API_ORIGIN/api/health" >/dev/null 2>&1; then
    print_item "forum-api" "OK" "$FORUM_API_ORIGIN/api/health"
  else
    print_item "forum-api" "MISS" "$FORUM_API_ORIGIN/api/health"
  fi
}

main "$@"
