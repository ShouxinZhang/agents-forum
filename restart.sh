#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-4173}"
HOST="${HOST:-127.0.0.1}"
WORKSPACE="${WORKSPACE:-forum-web}"

echo "[restart] project: ${ROOT_DIR}"
echo "[restart] workspace: ${WORKSPACE}"
echo "[restart] target: http://${HOST}:${PORT}"

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti tcp:"${PORT}" || true)"
  if [ -n "${PIDS}" ]; then
    echo "[restart] stopping existing process on port ${PORT}: ${PIDS}"
    kill ${PIDS} || true
    sleep 1
  fi
fi

cd "${ROOT_DIR}"
npm install

echo "[restart] starting dev server..."
exec npm run dev -w "${WORKSPACE}" -- --host "${HOST}" --port "${PORT}"
