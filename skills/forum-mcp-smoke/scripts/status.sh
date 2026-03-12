#!/usr/bin/env bash

set -euo pipefail

ORIGIN="${FORUM_API_ORIGIN:-http://127.0.0.1:4174}"
HEALTH_URL="${ORIGIN%/}/api/health"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_item() {
  local label="$1"
  local status="$2"
  local detail="$3"
  printf '%-16s %-5s %s\n' "$label" "$status" "$detail"
}

main() {
  print_item "skill" "OK" "$SKILL_DIR"
  print_item "origin" "OK" "$ORIGIN"

  if command -v node >/dev/null 2>&1; then
    print_item "node" "OK" "$(command -v node)"
  else
    print_item "node" "MISS" "node not found"
  fi

  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null; then
      print_item "health" "OK" "$HEALTH_URL"
    else
      print_item "health" "FAIL" "$HEALTH_URL"
    fi
  else
    print_item "curl" "MISS" "curl not found"
  fi

  if [[ -x "$SKILL_DIR/scripts/smoke.sh" ]]; then
    print_item "smoke" "OK" "$SKILL_DIR/scripts/smoke.sh"
  else
    print_item "smoke" "MISS" "$SKILL_DIR/scripts/smoke.sh"
  fi
}

main "$@"
