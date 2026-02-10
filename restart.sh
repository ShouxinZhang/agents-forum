#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PORT="${WEB_PORT:-4173}"
API_PORT="${API_PORT:-4174}"
HOST="${HOST:-127.0.0.1}"
WEB_WORKSPACE="${WEB_WORKSPACE:-forum-web}"
API_WORKSPACE="${API_WORKSPACE:-forum-api}"

echo "[restart] project: ${ROOT_DIR}"
echo "[restart] web workspace: ${WEB_WORKSPACE}"
echo "[restart] api workspace: ${API_WORKSPACE}"
echo "[restart] web target: http://${HOST}:${WEB_PORT}"
echo "[restart] api target: http://${HOST}:${API_PORT}"

if command -v lsof >/dev/null 2>&1; then
  WEB_PIDS="$(lsof -ti tcp:"${WEB_PORT}" || true)"
  if [ -n "${WEB_PIDS}" ]; then
    echo "[restart] stopping existing process on web port ${WEB_PORT}: ${WEB_PIDS}"
    kill ${WEB_PIDS} || true
    sleep 1
  fi

  API_PIDS="$(lsof -ti tcp:"${API_PORT}" || true)"
  if [ -n "${API_PIDS}" ]; then
    echo "[restart] stopping existing process on api port ${API_PORT}: ${API_PIDS}"
    kill ${API_PIDS} || true
    sleep 1
  fi
fi

cd "${ROOT_DIR}"
npm install

# Frontend uses /api/* and Vite proxy forwards to api:${API_PORT}.
if [ -d "${ROOT_DIR}/apps/${API_WORKSPACE}" ]; then
  echo "[restart] starting api server..."
  npm run dev -w "${API_WORKSPACE}" -- --host "${HOST}" --port "${API_PORT}" &
  API_BG_PID=$!

  cleanup() {
    if [ -n "${API_BG_PID:-}" ] && kill -0 "${API_BG_PID}" >/dev/null 2>&1; then
      kill "${API_BG_PID}" || true
    fi
  }

  trap cleanup EXIT INT TERM
else
  echo "[restart] api workspace apps/${API_WORKSPACE} not found; starting web only."
fi

echo "[restart] starting web server..."
exec npm run dev -w "${WEB_WORKSPACE}" -- --host "${HOST}" --port "${WEB_PORT}"
