#!/usr/bin/env bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
CHECK_SCRIPT="$SKILL_DIR/scripts/check-content.mjs"

print_item() {
  local label="$1"
  local status="$2"
  local detail="$3"
  printf '%-18s %-5s %s\n' "$label" "$status" "$detail"
}

main() {
  print_item "skill" "OK" "$SKILL_DIR"

  if command -v node >/dev/null 2>&1; then
    print_item "node" "OK" "$(command -v node)"
  else
    print_item "node" "MISS" "node not found"
  fi

  if [[ -f "$CHECK_SCRIPT" ]]; then
    print_item "check-script" "OK" "$CHECK_SCRIPT"
  else
    print_item "check-script" "MISS" "$CHECK_SCRIPT"
  fi
}

main "$@"
