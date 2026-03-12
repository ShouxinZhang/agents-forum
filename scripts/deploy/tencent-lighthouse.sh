#!/usr/bin/env bash

set -euo pipefail

HOST_ALIAS="${1:-}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_ROOT="${REMOTE_ROOT:-/home/${REMOTE_USER}/apps/agents-forum}"
REMOTE_WEB_ROOT="${REMOTE_WEB_ROOT:-/var/www/agents-forum}"
FORUM_BASE_PATH="${FORUM_BASE_PATH:-/fortum/}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-agents-forum-api}"
AGENT_SITE_PATH="${AGENT_SITE_PATH:-/etc/nginx/sites-available/agent-studio}"
NGINX_SNIPPET_NAME="${NGINX_SNIPPET_NAME:-agents-forum-fortum-location.conf}"
SSH_KEY_PATH="${SSH_KEY_PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SERVICE_TEMPLATE="${REPO_ROOT}/docs/deploy/assets/forum-api.service"
NGINX_TEMPLATE="${REPO_ROOT}/docs/deploy/assets/agent-fortum-location.conf"

if [ -z "${HOST_ALIAS}" ]; then
  echo "Usage: bash scripts/deploy/tencent-lighthouse.sh <ssh-host>"
  echo "Example: bash scripts/deploy/tencent-lighthouse.sh agent-studio-tencent"
  exit 1
fi

FORUM_BASE_PATH="/${FORUM_BASE_PATH#/}"
if [ "${FORUM_BASE_PATH}" != "/" ] && [ "${FORUM_BASE_PATH%/}" = "${FORUM_BASE_PATH}" ]; then
  FORUM_BASE_PATH="${FORUM_BASE_PATH}/"
fi
FORUM_BASE_PATH_TRIMMED="${FORUM_BASE_PATH%/}"
REMOTE_WEB_PUBLIC_ROOT="${REMOTE_WEB_ROOT}${FORUM_BASE_PATH_TRIMMED}"

SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
)

if [ -n "${SSH_KEY_PATH}" ]; then
  SSH_OPTS+=(-i "${SSH_KEY_PATH}")
fi

SSH_CMD=(ssh "${SSH_OPTS[@]}" "${HOST_ALIAS}")
RSYNC_RSH="ssh ${SSH_OPTS[*]}"

echo "[deploy] checking ssh connectivity: ${HOST_ALIAS}"
"${SSH_CMD[@]}" "echo '[remote] connected:' \$(whoami)@\$(hostname)"

echo "[deploy] syncing repository to ${HOST_ALIAS}:${REMOTE_ROOT}"
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.runtime' \
  --exclude 'apps/forum-api/.runtime' \
  --exclude 'apps/forum-web/dist' \
  --exclude 'scripts/repo-metadata/node_modules' \
  --exclude 'scripts/repo-map/node_modules' \
  -e "${RSYNC_RSH}" \
  "${REPO_ROOT}/" "${HOST_ALIAS}:${REMOTE_ROOT}/"

TMP_SERVICE="$(mktemp)"
TMP_NGINX="$(mktemp)"
TMP_PATCH="$(mktemp)"
trap 'rm -f "${TMP_SERVICE}" "${TMP_NGINX}" "${TMP_PATCH}"' EXIT

sed \
  -e "s|__SERVICE_USER__|${REMOTE_USER}|g" \
  -e "s|__REMOTE_DIR__|${REMOTE_ROOT}|g" \
  -e "s|__RUNTIME_DIR__|${REMOTE_ROOT}/.runtime|g" \
  "${SERVICE_TEMPLATE}" > "${TMP_SERVICE}"

sed \
  -e "s|__BASE_PATH__|${FORUM_BASE_PATH}|g" \
  -e "s|__BASE_PATH_TRIMMED__|${FORUM_BASE_PATH_TRIMMED}|g" \
  -e "s|__WEB_ROOT__|${REMOTE_WEB_ROOT}|g" \
  "${NGINX_TEMPLATE}" > "${TMP_NGINX}"

cat > "${TMP_PATCH}" <<'PY'
from pathlib import Path
from datetime import datetime
import shutil
import sys

site_path = Path(sys.argv[1])
snippet_path = Path(sys.argv[2])
text = site_path.read_text()
snippet_body = snippet_path.read_text().rstrip() + "\n"
start_marker = "    # agents-forum fortum start"
end_marker = "    # agents-forum fortum end"
managed_block = f"{start_marker}\n{snippet_body}{end_marker}\n\n"
backup_path = site_path.with_name(f"{site_path.name}.bak-{datetime.now().strftime('%Y%m%d%H%M%S')}")
shutil.copy2(site_path, backup_path)

if start_marker in text and end_marker in text:
    start = text.index(start_marker)
    end = text.index(end_marker) + len(end_marker)
    while end < len(text) and text[end] in "\r\n":
        end += 1
    text = text[:start] + managed_block + text[end:]
else:
    needle = "    # Next.js 前端"
    if needle not in text:
        needle = "    location / {"
    if needle not in text:
        raise SystemExit("failed to find insertion point in agent nginx site")
    text = text.replace(needle, managed_block + needle, 1)

site_path.write_text(text)
PY

echo "[deploy] uploading rendered deployment assets"
cat "${TMP_SERVICE}" | "${SSH_CMD[@]}" "cat > /tmp/${SYSTEMD_UNIT}.service"
cat "${TMP_NGINX}" | "${SSH_CMD[@]}" "cat > /tmp/${NGINX_SNIPPET_NAME}"
cat "${TMP_PATCH}" | "${SSH_CMD[@]}" "cat > /tmp/agents-forum-patch-nginx.py"

echo "[deploy] installing dependencies and building forum-web"
"${SSH_CMD[@]}" "cd '${REMOTE_ROOT}' && npm install && FORUM_WEB_BASE_PATH='${FORUM_BASE_PATH}' npm run build -w forum-web"

echo "[deploy] installing systemd service and patching nginx subpath"
"${SSH_CMD[@]}" "\
  sudo mkdir -p '${REMOTE_WEB_PUBLIC_ROOT}' && \
  sudo rsync -a --delete '${REMOTE_ROOT}/apps/forum-web/dist/' '${REMOTE_WEB_PUBLIC_ROOT}/' && \
  sudo cp /tmp/${SYSTEMD_UNIT}.service /etc/systemd/system/${SYSTEMD_UNIT}.service && \
  sudo systemctl daemon-reload && \
  sudo systemctl enable --now ${SYSTEMD_UNIT} && \
  sudo python3 /tmp/agents-forum-patch-nginx.py '${AGENT_SITE_PATH}' '/tmp/${NGINX_SNIPPET_NAME}' && \
  sudo nginx -t && \
  sudo systemctl reload nginx \
"

echo "[deploy] health checks"
"${SSH_CMD[@]}" "\
  echo '--- systemd ---' && \
  sudo systemctl status ${SYSTEMD_UNIT} --no-pager | sed -n '1,12p' && \
  echo '--- api health ---' && \
  curl -s http://127.0.0.1:4174/api/health && \
  echo && \
  echo '--- fortum head ---' && \
  curl -k -I -s https://agent.wudizhe.com${FORUM_BASE_PATH} | sed -n '1,10p' \
"

echo "[deploy] completed"
